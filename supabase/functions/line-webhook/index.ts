// supabase/functions/line-webhook/index.ts
// LINE Messaging API webhook 接收端
//
// 任務:
//   1. 驗證 x-line-signature (HMAC-SHA256, channel secret)
//   2. bot 被加入群組 (join) → upsert line_groups, is_active=true
//   3. bot 被踢出群組 (leave) → 標記 is_active=false, left_at=now()
//   4. 收到訊息 → (a) 確保 line_groups 有記錄 (b) 檢查是否為 !指令 → 用 reply API 免費回覆
//
// 支援指令 (全部以 ! 或 ！開頭):
//   !公告   → 回覆 app_settings.bot_reply_announcement_text
//   !活動   → 回覆未來 5 場活動
//   !例會   → 下一場例會活動
//   !組聚   → 下一場組聚（舊名咖啡會議，!咖啡 仍可用）
//   !培訓   → 下一場商務培訓
//   !名單   → 進行中的接龍：只有一張就依組別列名單，多張則列清單
//   !幫助 / !help / !? → 指令清單
//
// 必要 secrets: LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN
//                  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (自動注入)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const SITE_URL = "https://changzhan.vercel.app";
// 接龍報名的 LIFF app（與前端 VITE_LIFF_SIGNUP_ID 一致）
const LIFF_SIGNUP_ID = "2009854899-KEtH0Qad";
const GROUPLESS = "未分組";
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-line-signature",
};

// === 簽名驗證 ===
async function verifySignature(secret: string, body: string, signature: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

// === 指令解析 ===
function parseCommand(text: string | undefined | null): string | null {
  if (!text) return null;
  const t = text.trim();
  if (!t.startsWith("!") && !t.startsWith("！")) return null;
  const stripped = t.slice(1).trim();
  if (!stripped) return null;
  return stripped.split(/\s+/)[0].toLowerCase();
}

const CMD_ANNOUNCEMENT = new Set(["公告", "最新公告", "announcement", "news"]);
const CMD_ACTIVITIES   = new Set(["活動", "近期活動", "events"]);
const CMD_REGULAR      = new Set(["例會", "商務例會", "meeting"]);
// 活動類型已從「咖啡會議」改名為「組聚」，舊的 !咖啡 保留為別名
const CMD_GROUP_MEET   = new Set(["組聚", "咖啡", "咖啡會議", "coffee", "group"]);
const CMD_TRAINING     = new Set(["培訓", "商務培訓", "training"]);
const CMD_SIGNUP       = new Set(["名單", "接龍", "報名", "signup", "list"]);
const CMD_HELP         = new Set(["幫助", "說明", "help", "?", "？", "menu"]);

// === 按類型查未來活動 ===
async function fetchUpcoming(supabase: any, type: string | null, limit: number) {
  let q = supabase
    .from("activities")
    .select("id, title, date, time, location, type, status")
    .or("status.eq.active,status.is.null")
    .order("date", { ascending: true })
    .order("time", { ascending: true });
  if (type) q = q.eq("type", type);
  const { data, error } = await q.limit(50);
  if (error || !data) return [];
  const now = new Date();
  return data
    .filter((a: any) => {
      const full = new Date(`${(a.date || "").replace(/-/g, "/")} ${a.time || "00:00"}`);
      return full > now;
    })
    .slice(0, limit);
}

function formatActivityList(title: string, list: any[], emptyMsg: string): string {
  if (list.length === 0) return `${title}\n\n${emptyMsg}`;
  const lines = list.map((a) => {
    const dt = `${a.date}${a.time ? ` ${a.time}` : ""}`;
    return `▸ ${a.title}\n  📅 ${dt}${a.location ? `\n  📍 ${a.location}` : ""}`;
  });
  return `${title}\n\n${lines.join("\n\n")}\n\n🔗 詳細：${SITE_URL}`;
}

function formatSingleActivity(label: string, a: any | undefined, emptyMsg: string): string {
  if (!a) return `${label}\n\n${emptyMsg}`;
  return `${label}\n\n▸ ${a.title}\n📅 日期：${a.date}${a.time ? ` ${a.time}` : ""}${a.location ? `\n📍 地點：${a.location}` : ""}\n\n🔗 報名：${SITE_URL}/activity/${a.id}`;
}

// === 接龍 ===
const signupUrl = (token: string) =>
  `https://liff.line.me/${LIFF_SIGNUP_ID}?sheet=${encodeURIComponent(token)}`;

const fmtDeadline = (iso: string) =>
  new Date(iso).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// activities.date 是純日期字串，new Date('2026-09-15') 會被當 UTC 而差一天，
// 所以自己拆字串、用本地時間建構來算星期。
function fmtActivityDate(date: string, time?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
  if (!m) return `${date ?? ""}${time ? ` ${time}` : ""}`;
  const [, y, mo, d] = m;
  const wd = WEEKDAYS[new Date(+y, +mo - 1, +d).getDay()];
  return `${+mo}/${+d}（${wd}）${time ? ` ${time}` : ""}`;
}

const nt = (n: number) => `NT$ ${Number(n).toLocaleString("zh-TW")}`;

// 金額行：有會員價就兩級都列，跟 LIFF 報名頁一致
function feeLine(sheet: any): string {
  if (sheet.member_fee != null) {
    return `\n💰 會員 ${nt(sheet.member_fee)}／一般 ${nt(sheet.fee)}`;
  }
  return sheet.fee > 0 ? `\n💰 每人 ${nt(sheet.fee)}` : "";
}

// 組名排序：數字用數值比較（1→2→10→20），未分組排最後
const compareGroup = (a: string, b: string) => {
  if (a === b) return 0;
  if (a === GROUPLESS) return 1;
  if (b === GROUPLESS) return -1;
  return a.localeCompare(b, "zh-TW", { numeric: true });
};

// 同一張接龍可以貼到多個群（共用同一份名單），但接龍本身不綁群組，
// 所以同時有多張進行中時無法推斷要回哪一張 → 多張就列清單讓使用者選。
// 截止時間在程式裡篩，不用 PostgREST 的 or() 帶 ISO 時間字串（解析容易出意外）。
async function formatSignupList(supabase: any): Promise<string> {
  const { data: sheets } = await supabase
    .from("signup_sheets")
    .select("id, token, title, description, deadline, max_people, fee, member_fee, activity_id")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(20);

  const now = Date.now();
  const openSheets = (sheets ?? []).filter(
    (s: any) => !s.deadline || new Date(s.deadline).getTime() > now,
  );

  if (openSheets.length === 0) {
    return "📋 目前沒有進行中的接龍。";
  }

  // 日期地點來自綁定的活動；自由主題的接龍沒有這些資訊
  const actIds = openSheets.map((s: any) => s.activity_id).filter(Boolean);
  const actById = new Map<string, any>();
  if (actIds.length > 0) {
    const { data: acts } = await supabase
      .from("activities")
      .select("id, title, date, time, location")
      .in("id", actIds);
    (acts ?? []).forEach((a: any) => actById.set(String(a.id), a));
  }
  const actOf = (s: any) => (s.activity_id ? actById.get(String(s.activity_id)) : null);

  const { data: allEntries } = await supabase
    .from("signup_entries")
    .select("sheet_id, real_name, extra_count, member_id, created_at")
    .in("sheet_id", openSheets.map((s: any) => s.id))
    .order("created_at", { ascending: true });

  // 同一場活動也可能有人從公開頁的報名表進來（不走接龍）。
  // 不加進來的話「目前 N 人」會少算，甚至明明有人報名卻回「還沒有人報名」。
  const webByActivity = new Map<string, string[]>();
  if (actIds.length > 0) {
    const { data: regs } = await supabase
      .from("registrations")
      .select('name, "activityId", created_at')
      .in("activityId", actIds)
      .order("created_at", { ascending: true });
    (regs ?? []).forEach((r: any) => {
      const k = String(r.activityId);
      if (!webByActivity.has(k)) webByActivity.set(k, []);
      webByActivity.get(k)!.push(r.name);
    });
  }
  const webOf = (s: any) => (s.activity_id ? webByActivity.get(String(s.activity_id)) ?? [] : []);

  const entriesOf = (sheetId: number) =>
    (allEntries ?? []).filter((e: any) => e.sheet_id === sheetId);
  const headOf = (sheetId: number) =>
    entriesOf(sheetId).reduce((sum: number, e: any) => sum + 1 + (e.extra_count ?? 0), 0);

  // 多張 → 列清單，各自附上日期與連結
  if (openSheets.length > 1) {
    const blocks = openSheets.map((s: any) => {
      const a = actOf(s);
      const cap = s.max_people ? ` / ${s.max_people}` : "";
      const when = a?.date ? `\n  📅 ${fmtActivityDate(a.date, a.time)}` : "";
      const where = a?.location ? `\n  📍 ${a.location}` : "";
      const deadline = s.deadline ? `\n  ⏰ 截止 ${fmtDeadline(s.deadline)}` : "";
      const web = webOf(s).length;
      const webNote = web > 0 ? `（含網頁報名 ${web}）` : "";
      return `▸ ${s.title}${when}${where}\n  👥 ${headOf(s.id) + web} 人${cap}${webNote}${deadline}\n  🔗 ${signupUrl(s.token)}`;
    });
    return `📋 目前有 ${openSheets.length} 張接龍進行中\n\n${blocks.join("\n\n")}\n\n點連結即可報名並查看完整名單。`;
  }

  // 只有一張 → 依組別列出名單
  const sheet = openSheets[0];
  const act = actOf(sheet);
  const rows = entriesOf(sheet.id);
  const cap = sheet.max_people ? ` / ${sheet.max_people}` : "";
  const when = act?.date ? `\n📅 ${fmtActivityDate(act.date, act.time)}` : "";
  const where = act?.location ? `\n📍 ${act.location}` : "";
  const deadline = sheet.deadline ? `\n⏰ 截止：${fmtDeadline(sheet.deadline)}` : "";
  const webNames = webOf(sheet);
  const total = headOf(sheet.id) + webNames.length;
  const head = `📋 ${sheet.title}${when}${where}${feeLine(sheet)}\n👥 目前 ${total} 人${cap}${deadline}`;
  // 網頁報名的人不在接龍裡，另外列一段，並提醒不用重複幫他們 +1
  const webBlock = webNames.length > 0
    ? `\n\n📝 從網頁報名（${webNames.length}）\n　${webNames.join("、")}\n（這些夥伴不在接龍裡，不用重複 +1）`
    : "";

  if (rows.length === 0) {
    const empty = webNames.length > 0 ? "（接龍還沒有人，可直接 +1）" : "（還沒有人報名）";
    return `${head}\n\n${empty}${webBlock}\n\n🔗 我要報名：${signupUrl(sheet.token)}`;
  }

  // 組別取自會員資料；來賓與沒設組別的會員歸「未分組」
  const memberIds = rows.map((e: any) => e.member_id).filter(Boolean);
  const groupById = new Map<string, string>();
  if (memberIds.length > 0) {
    const { data: ms } = await supabase
      .from("members")
      .select("id, group_name")
      .in("id", memberIds);
    (ms ?? []).forEach((m: any) => groupById.set(String(m.id), m.group_name || ""));
  }

  const buckets = new Map<string, string[]>();
  for (const e of rows) {
    const g = (e.member_id ? groupById.get(String(e.member_id)) : "") || GROUPLESS;
    const label = `${e.real_name}${e.extra_count > 0 ? `+${e.extra_count}` : ""}`;
    if (!buckets.has(g)) buckets.set(g, []);
    buckets.get(g)!.push(label);
  }

  const lines = Array.from(buckets.keys())
    .sort(compareGroup)
    .map((g) => {
      const names = buckets.get(g)!;
      // 人頭數含同行者，跟上方的「目前 N 人」對得起來
      const heads = names.reduce((sum, n) => sum + 1 + (Number(n.split("+")[1]) || 0), 0);
      return `▪ ${g}（${heads}人）\n　${names.join("、")}`;
    });

  return `${head}\n\n${lines.join("\n")}${webBlock}\n\n🔗 我要報名：${signupUrl(sheet.token)}`;
}

function helpMessage(): string {
  return [
    "💬 長展小幫手 指令清單",
    "",
    "!公告   — 查看最新公告",
    "!活動   — 近期全部活動",
    "!例會   — 下一場例會",
    "!組聚   — 下一場組聚",
    "!培訓   — 下一場商務培訓",
    "!名單   — 接龍報名名單（依組別）",
    "!幫助   — 顯示這張選單",
    "",
    `🔗 完整資訊：${SITE_URL}`,
  ].join("\n");
}

// === Reply API ===
async function replyText(token: string, replyToken: string, text: string) {
  const res = await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
  if (!res.ok) {
    console.error(`Reply API ${res.status}: ${await res.text()}`);
  }
}

// === 指令路由 ===
async function handleCommand(
  cmd: string,
  replyToken: string,
  supabase: any,
  token: string,
  settings: Record<string, string>,
) {
  if (CMD_ANNOUNCEMENT.has(cmd)) {
    const body = settings.bot_reply_announcement_text || "目前沒有公告。";
    await replyText(token, replyToken, `📣 最新公告\n\n${body}`);
    return true;
  }
  if (CMD_ACTIVITIES.has(cmd)) {
    const list = await fetchUpcoming(supabase, null, 5);
    await replyText(token, replyToken, formatActivityList("📅 近期活動", list, "目前沒有近期活動"));
    return true;
  }
  if (CMD_REGULAR.has(cmd)) {
    const list = await fetchUpcoming(supabase, "例會活動", 1);
    await replyText(token, replyToken, formatSingleActivity("⚡ 下一場例會", list[0], "目前沒有排定的例會。"));
    return true;
  }
  if (CMD_GROUP_MEET.has(cmd)) {
    const list = await fetchUpcoming(supabase, "組聚", 1);
    await replyText(token, replyToken, formatSingleActivity("☕ 下一場組聚", list[0], "目前沒有排定的組聚。"));
    return true;
  }
  if (CMD_TRAINING.has(cmd)) {
    const list = await fetchUpcoming(supabase, "商務培訓", 1);
    await replyText(token, replyToken, formatSingleActivity("🎓 下一場商務培訓", list[0], "目前沒有排定的商務培訓。"));
    return true;
  }
  if (CMD_SIGNUP.has(cmd)) {
    await replyText(token, replyToken, await formatSignupList(supabase));
    return true;
  }
  if (CMD_HELP.has(cmd)) {
    await replyText(token, replyToken, helpMessage());
    return true;
  }
  await replyText(token, replyToken, `❓ 不識得的指令：!${cmd}\n\n輸入 !幫助 查看指令清單`);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const channelSecret = Deno.env.get("LINE_CHANNEL_SECRET");
  const channelToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!channelSecret || !channelToken) {
    console.error("LINE_CHANNEL_SECRET or LINE_CHANNEL_ACCESS_TOKEN not configured");
    return new Response("server misconfigured", { status: 500, headers: corsHeaders });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  const valid = await verifySignature(channelSecret, rawBody, signature);
  if (!valid) {
    console.warn("Invalid LINE signature");
    return new Response("invalid signature", { status: 401, headers: corsHeaders });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400, headers: corsHeaders });
  }

  const events: any[] = payload?.events ?? [];
  if (events.length === 0) {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: settingsRows } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["bot_reply_enabled", "bot_reply_announcement_text"]);
  const settings: Record<string, string> = {};
  (settingsRows ?? []).forEach((r: any) => { settings[r.key] = r.value ?? ""; });
  const botEnabled = (settings.bot_reply_enabled ?? "true") !== "false";

  for (const event of events) {
    try {
      const sourceType = event?.source?.type;
      const groupId = event?.source?.groupId;

      if (sourceType === "group" && groupId) {
        if (event.type === "join") {
          await supabase.from("line_groups").upsert(
            { line_group_id: groupId, is_active: true, joined_at: new Date().toISOString(), left_at: null },
            { onConflict: "line_group_id" },
          );
          console.log(`bot joined group ${groupId}`);
        } else if (event.type === "leave") {
          await supabase.from("line_groups")
            .update({ is_active: false, left_at: new Date().toISOString() })
            .eq("line_group_id", groupId);
          console.log(`bot left group ${groupId}`);
        } else if (event.type === "message") {
          await supabase.from("line_groups").upsert(
            { line_group_id: groupId, is_active: true },
            { onConflict: "line_group_id", ignoreDuplicates: false },
          );
        }
      }

      if (event.type === "message" && event.message?.type === "text" && event.replyToken) {
        if (!botEnabled) continue;
        const cmd = parseCommand(event.message.text);
        if (!cmd) continue;
        await handleCommand(cmd, event.replyToken, supabase, channelToken, settings);
      }
    } catch (e) {
      console.error("event handler error:", e);
    }
  }

  return new Response("ok", { status: 200, headers: corsHeaders });
});
