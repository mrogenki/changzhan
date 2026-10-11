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
// 網頁報名沒填引薦人、但報名者本人就是會員時，用這個當分段 key（不會跟任何人名撞到）
const SELF_KEY = "\u0000self";
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

const CMD_ANNOUNCEMENT = new Set(["公告", "最新公告", "announcement", "news"]);
const CMD_ACTIVITIES   = new Set(["活動", "近期活動", "events"]);
const CMD_REGULAR      = new Set(["例會", "商務例會", "meeting"]);
// 活動類型已從「咖啡會議」改名為「組聚」，舊的 !咖啡 保留為別名
const CMD_GROUP_MEET   = new Set(["組聚", "咖啡", "咖啡會議", "coffee", "group"]);
const CMD_TRAINING     = new Set(["培訓", "商務培訓", "training"]);
const CMD_SIGNUP       = new Set(["名單", "接龍", "報名", "signup", "list"]);
const CMD_HELP         = new Set(["幫助", "說明", "help", "?", "？", "menu"]);

const ALL_COMMANDS = [
  ...CMD_ANNOUNCEMENT, ...CMD_ACTIVITIES, ...CMD_REGULAR,
  ...CMD_GROUP_MEET, ...CMD_TRAINING, ...CMD_SIGNUP, ...CMD_HELP,
].sort((a, b) => b.length - a.length);   // 長的先比，避免 "名單" 先吃掉 "名單查詢"

/**
 * 解析指令與後面的參數。
 * 「!名單 商機日」會拆成 { cmd: "名單", arg: "商機日" }。
 * ⚠️ 中文輸入常常不打空格（「!名單商機日」），所以沒有空白時再用前綴比對一次。
 */
function parseCommand(text: string | undefined | null): { cmd: string; arg: string } | null {
  if (!text) return null;
  const t = text.trim();
  if (!t.startsWith("!") && !t.startsWith("！")) return null;
  const stripped = t.slice(1).trim();
  if (!stripped) return null;

  const spaceIdx = stripped.search(/\s/);
  if (spaceIdx > 0) {
    return {
      cmd: stripped.slice(0, spaceIdx).toLowerCase(),
      arg: stripped.slice(spaceIdx + 1).trim(),
    };
  }

  const lower = stripped.toLowerCase();
  const hit = ALL_COMMANDS.find((c) => lower.startsWith(c) && lower.length > c.length);
  if (hit) return { cmd: hit, arg: stripped.slice(hit.length).trim() };
  return { cmd: lower, arg: "" };
}

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
// `!名單`：列出報名名單。
//
// 兩種來源都要算進來，否則會漏：
//   · **接龍**（signup_sheets）——LINE 裡 +1 的
//   · **只有網頁報名的活動**——沒開接龍的場次（例會、擴大商機日那種），
//     原本整個查不到；實際發生過「11 人報名但 !名單 叫不出來」。
//
// 接龍不綁群組，同時有多張時無法推斷要回哪一張，所以：
//   · 剛好一個對象 → 直接列完整名單
//   · 多個 → 列清單讓人點，或用 `!名單 關鍵字` 指定
type ListTarget = {
  kind: "sheet" | "activity";
  title: string;
  activity: any | null;
  sheet: any | null;
  count: number;        // 顯示用的人頭數
};

const todayTpe = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());

async function formatSignupList(supabase: any, keyword = ""): Promise<string> {
  const kw = keyword.trim().toLowerCase();

  // --- 1) 進行中的接龍 ---
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

  // --- 2) 近期活動（用來補標題、也用來找「只有網頁報名」的場次）---
  const { data: acts } = await supabase
    .from("activities")
    .select("id, title, date, time, location, type, status, is_internal")
    .or("status.eq.active,status.is.null")
    .gte("date", todayTpe())
    .order("date", { ascending: true })
    .limit(60);
  const upcoming = (acts ?? []).filter((a: any) => !a.is_internal);

  const sheetActIds = new Set(openSheets.map((s: any) => String(s.activity_id)).filter(Boolean));
  const actById = new Map<string, any>();
  upcoming.forEach((a: any) => actById.set(String(a.id), a));
  // 接龍綁的活動可能已經過去（例如今天稍早），補撈回來才顯示得出日期地點
  const missingIds = [...sheetActIds].filter((id) => !actById.has(id));
  if (missingIds.length > 0) {
    const { data: more } = await supabase
      .from("activities").select("id, title, date, time, location, type").in("id", missingIds);
    (more ?? []).forEach((a: any) => actById.set(String(a.id), a));
  }
  const actOf = (s: any) => (s.activity_id ? actById.get(String(s.activity_id)) ?? null : null);

  // --- 3) 報名資料 ---
  const allActIds = [...new Set([...sheetActIds, ...upcoming.map((a: any) => String(a.id))])];
  const regsByActivity = new Map<string, any[]>();
  if (allActIds.length > 0) {
    const { data: regs } = await supabase
      .from("registrations")
      // ⚠️ company / title / referrer 一定要撈：名單要依引薦人分組並顯示單位職務。
      //    漏掉的話畫面不會報錯，只會安靜地全部變成「未分組・未填引薦人」——實際踩過。
      .select('name, phone, company, title, referrer, "activityId", created_at')
      .in("activityId", allActIds)
      .order("created_at", { ascending: true });
    (regs ?? []).forEach((r: any) => {
      const k = String(r.activityId);
      if (!regsByActivity.has(k)) regsByActivity.set(k, []);
      regsByActivity.get(k)!.push(r);
    });
  }
  const webOf = (activityId: any) =>
    activityId ? regsByActivity.get(String(activityId)) ?? [] : [];

  const { data: allEntries } = openSheets.length > 0
    ? await supabase
        .from("signup_entries")
        .select("sheet_id, real_name, extra_count, member_id, created_at")
        .in("sheet_id", openSheets.map((s: any) => s.id))
        .order("created_at", { ascending: true })
    : { data: [] as any[] };
  const entriesOf = (sheetId: number) =>
    (allEntries ?? []).filter((e: any) => e.sheet_id === sheetId);
  const headOf = (sheetId: number) =>
    entriesOf(sheetId).reduce((sum: number, e: any) => sum + 1 + (e.extra_count ?? 0), 0);

  // --- 4) 把兩種來源併成同一份候選清單 ---
  const targets: ListTarget[] = [
    ...openSheets.map((s: any) => {
      const a = actOf(s);
      return {
        kind: "sheet" as const,
        title: s.title || a?.title || "（未命名接龍）",
        activity: a,
        sheet: s,
        count: headOf(s.id) + webOf(s.activity_id).length,
      };
    }),
    // 沒開接龍、但已經有人從網頁報名的活動
    ...upcoming
      .filter((a: any) => !sheetActIds.has(String(a.id)) && webOf(a.id).length > 0)
      .map((a: any) => ({
        kind: "activity" as const,
        title: a.title,
        activity: a,
        sheet: null,
        count: webOf(a.id).length,
      })),
  ];

  // 照活動日期排，近的在前；沒綁活動的排最後（22 張接龍時這個差很多）
  targets.sort((a, b) => {
    const da = a.activity?.date ?? "9999-99-99";
    const db = b.activity?.date ?? "9999-99-99";
    if (da !== db) return da.localeCompare(db);
    return String(a.activity?.time ?? "").localeCompare(String(b.activity?.time ?? ""));
  });

  if (targets.length === 0) {
    return "📋 目前沒有進行中的接龍，也沒有已報名的近期活動。";
  }

  // --- 5) 關鍵字篩選 ---
  const matched = kw
    ? targets.filter((t) =>
        t.title.toLowerCase().includes(kw) ||
        String(t.activity?.title ?? "").toLowerCase().includes(kw))
    : targets;

  if (kw && matched.length === 0) {
    const names = targets.map((t) => `▸ ${t.title}`).join("\n");
    return `🔍 找不到含「${keyword}」的活動。\n\n目前有這些：\n${names}\n\n可以換個關鍵字，或直接打 !名單`;
  }

  // --- 6) 多筆 → 列清單 ---
  if (matched.length > 1) {
    const blocks = matched.map((t) => {
      const a = t.activity;
      const when = a?.date ? `\n  📅 ${fmtActivityDate(a.date, a.time)}` : "";
      const where = a?.location ? `\n  📍 ${a.location}` : "";
      if (t.kind === "sheet") {
        const cap = t.sheet.max_people ? ` / ${t.sheet.max_people}` : "";
        const deadline = t.sheet.deadline ? `\n  ⏰ 截止 ${fmtDeadline(t.sheet.deadline)}` : "";
        return `▸ ${t.title}${when}${where}\n  👥 ${t.count} 人${cap}${deadline}\n  🔗 ${signupUrl(t.sheet.token)}`;
      }
      return `▸ ${t.title}（網頁報名）${when}${where}\n  👥 ${t.count} 人\n  🔗 ${SITE_URL}/activity/${a.id}`;
    });
    // 範例關鍵字挑「不含空白、最短」的標題，免得切出「3 組1」這種怪字串
    const sample = matched
      .map((x) => x.title.replace(/\s+/g, ""))
      .filter((x) => x.length >= 2)
      .sort((a, b) => a.length - b.length)[0];
    const hint = sample
      ? `想看完整名單請打「!名單 關鍵字」，例如：!名單 ${sample.slice(0, 6)}`
      : "想看完整名單請打「!名單」加上活動名稱裡的幾個字";
    return `📋 共 ${matched.length} 場有報名資料\n\n${blocks.join("\n\n")}\n\n${hint}`;
  }

  // --- 7) 只有一筆 → 列完整名單 ---
  const t = matched[0];
  const act = t.activity;
  const when = act?.date ? `\n📅 ${fmtActivityDate(act.date, act.time)}` : "";
  const where = act?.location ? `\n📍 ${act.location}` : "";

  // 組別取自會員資料
  const { data: allMembers } = await supabase
    .from("members").select("id, name, group_name");
  const groupById = new Map<string, string>();
  const groupByName = new Map<string, string>();
  (allMembers ?? []).forEach((m: any) => {
    groupById.set(String(m.id), m.group_name || "");
    if (m.name) groupByName.set(String(m.name).trim(), m.group_name || "");
  });

  const cap = t.sheet?.max_people ? ` / ${t.sheet.max_people}` : "";
  const deadline = t.sheet?.deadline ? `\n⏰ 截止：${fmtDeadline(t.sheet.deadline)}` : "";
  const fee = t.sheet ? feeLine(t.sheet) : "";
  const head = `📋 ${t.title}${when}${where}${fee}\n👥 目前 ${t.count} 人${cap}${deadline}`;
  const link = t.sheet
    ? `\n\n🔗 我要報名：${signupUrl(t.sheet.token)}`
    : (act ? `\n\n🔗 報名：${SITE_URL}/activity/${act.id}` : "");

  if (t.count === 0) {
    return `${head}\n\n（還沒有人報名）${link}`;
  }

  const groupLabel = (g: string) => (g === GROUPLESS ? g : /^\d+$/.test(g) ? `第 ${g} 組` : g);

  // --- 接龍名單：依報名者自己的組別 ---
  const sheetSection = () => {
    if (t.kind !== "sheet") return "";
    const buckets = new Map<string, string[]>();
    entriesOf(t.sheet.id).forEach((e: any) => {
      // 會員用自己的組；非會員（來賓）掛在引薦人的組下面
      const g = (e.member_id
        ? groupById.get(String(e.member_id))
        : groupByName.get(String(e.referrer ?? "").trim())) || GROUPLESS;
      if (!buckets.has(g)) buckets.set(g, []);
      buckets.get(g)!.push(`${e.real_name}${e.extra_count > 0 ? `+${e.extra_count}` : ""}`);
    });
    if (buckets.size === 0) return "";
    return Array.from(buckets.keys()).sort(compareGroup).map((g) => {
      const names = buckets.get(g)!;
      // 人頭數含同行者，跟上方的「目前 N 人」對得起來
      const heads = names.reduce((sum, n) => sum + 1 + (Number(n.split("+")[1]) || 0), 0);
      return `▪ ${groupLabel(g)}（${heads}人）\n　${names.join("、")}`;
    }).join("\n");
  };

  // --- 網頁報名：依「引薦人的組別 → 引薦人」分段，並顯示單位與職務 ---
  //
  // 來賓本人不是會員，用他自己的名字查組別永遠查不到（原本整段都落在「未分組」）。
  // 每位引薦人都屬於某一組，所以組別要從**引薦人**推。
  const webSection = () => {
    const regs = webOf(t.sheet ? t.sheet.activity_id : act?.id);
    if (regs.length === 0) return "";
    type Row = { name: string; company: string; title: string };
    const byGroup = new Map<string, Map<string, Row[]>>();
    regs.forEach((r: any) => {
      const ref = String(r.referrer ?? "").trim();
      const self = String(r.name ?? "").trim();
      // 沒填引薦人時，報名的可能是會員自己（例如組聚自己報自己），用他本人的組別
      const selfGroup = ref ? undefined : groupByName.get(self);
      const g = groupByName.get(ref) || selfGroup || GROUPLESS;
      if (!byGroup.has(g)) byGroup.set(g, new Map());
      const byRef = byGroup.get(g)!;
      const key = ref || (selfGroup !== undefined ? SELF_KEY : "");
      if (!byRef.has(key)) byRef.set(key, []);
      byRef.get(key)!.push({
        name: String(r.name ?? "—").trim(),
        company: String(r.company ?? "").trim(),
        title: String(r.title ?? "").trim(),
      });
    });

    const blocks: string[] = [];
    Array.from(byGroup.keys()).sort(compareGroup).forEach((g) => {
      const byRef = byGroup.get(g)!;
      Array.from(byRef.keys()).sort((a, b) => {
        const wa = !a || a === SELF_KEY ? 1 : 0;   // 沒引薦人／自行報名的排最後
        const wb = !b || b === SELF_KEY ? 1 : 0;
        if (wa !== wb) return wa - wb;
        return a.localeCompare(b, "zh-Hant");
      }).forEach((ref) => {
        const rows = byRef.get(ref)!;
        const who = rows.map((x) => {
          const job = [x.company, x.title].filter(Boolean).join(" ");
          return `　・${x.name}${job ? `｜${job}` : ""}`;
        }).join("\n");
        const by = ref === SELF_KEY ? "· 會員自行報名" : ref ? `· 引薦人 ${ref}` : "· 未填引薦人";
        blocks.push(`▪ ${groupLabel(g)}（${rows.length}人）${by}\n${who}`);
      });
    });
    return blocks.join("\n");
  };

  const sheetPart = sheetSection();
  const webPart = webSection();
  const webHeading = sheetPart && webPart ? "\n\n📝 從網頁報名\n" : "";
  const body = [sheetPart, webHeading ? webHeading.trim() + "\n" + webPart : webPart]
    .filter(Boolean).join(sheetPart && webPart ? "\n\n" : "");

  const note = t.kind === "activity" ? "\n\n（這場沒有開接龍，名單來自網頁報名）" : "";
  return `${head}\n\n${body}${note}${link}`;
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
    "!名單   — 報名名單（依組別）",
    "!名單 關鍵字 — 指定活動，例如 !名單 商機日",
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
  arg: string,
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
    await replyText(token, replyToken, await formatSignupList(supabase, arg));
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
        const parsed = parseCommand(event.message.text);
        if (!parsed) continue;
        await handleCommand(parsed.cmd, parsed.arg, event.replyToken, supabase, channelToken, settings);
      }
    } catch (e) {
      console.error("event handler error:", e);
    }
  }

  return new Response("ok", { status: 200, headers: corsHeaders });
});
