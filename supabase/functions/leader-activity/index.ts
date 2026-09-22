// supabase/functions/leader-activity/index.ts
// 小組長在 LINE 裡自助發起組聚（不用登入後台）
//
// 為什麼要有這支，而不是像接龍一樣直接呼叫 SECURITY DEFINER RPC：
//   接龍頁是直接相信前端傳上來的 LINE user ID。對「報名 +1」沒什麼風險，
//   但「建立公開活動」不一樣——只要知道某位小組長的 LINE ID 就能冒名發活動。
//   所以這裡要求前端帶 LIFF 的 ID token，由伺服器向 LINE 驗證，
//   確認真的是本人之後才寫入（service role）。
//
// action:
//   me      → 我是誰、哪一組、是不是小組長、我發起過的組聚
//   create  → 建立組聚活動 + 綁定的接龍，回傳接龍 token
//   update  → 修改自己發起的組聚（同步更新接龍的標題與費用）
//   cancel  → 取消自己發起的組聚（活動與接龍都改為 closed）
//
// 必要 secrets：SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（自動注入）
// 選填：LINE_LOGIN_CHANNEL_ID —— LIFF app 所屬 LINE Login channel 的 ID。
//       沒設就用長展的；LIFF ID 的格式是「<channel id>-<亂碼>」，前半段就是它。

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";
const DEFAULT_CHANNEL_ID = "2009854899";
const GROUP_MEETING = "組聚";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** 向 LINE 驗證 ID token，回傳 LINE user ID（sub）；驗證失敗回 null */
async function verifyIdToken(idToken: string): Promise<string | null> {
  const clientId = Deno.env.get("LINE_LOGIN_CHANNEL_ID") || DEFAULT_CHANNEL_ID;
  const res = await fetch(LINE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
  });
  if (!res.ok) {
    console.warn("LINE id_token verify failed:", res.status, await res.text());
    return null;
  }
  const payload = await res.json();
  return typeof payload?.sub === "string" ? payload.sub : null;
}

/** 活動日期時間（台北）→ 接龍截止時間的 ISO 字串 */
function taipeiIso(date: string, time: string): string {
  return new Date(`${date}T${time || "00:00"}:00+08:00`).toISOString();
}

const toInt = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

type Input = {
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
  price?: unknown;
  member_price?: unknown;
  max_people?: unknown;
};

/** 檢查並整理表單欄位；有錯就回錯誤訊息字串 */
function clean(input: Input, groupName: string) {
  const date = String(input.date ?? "").trim();
  const time = String(input.time ?? "").trim();
  const location = String(input.location ?? "").trim();
  if (!DATE_RE.test(date)) return "請選擇日期";
  if (!TIME_RE.test(time)) return "請選擇時間";
  if (!location) return "請填地點";

  const price = toInt(input.price) ?? 0;
  const memberPrice = toInt(input.member_price);
  const maxPeople = toInt(input.max_people);
  if (Number.isNaN(price) || Number.isNaN(memberPrice) || Number.isNaN(maxPeople)) {
    return "金額與人數要填 0 以上的整數";
  }

  const title = String(input.title ?? "").trim() || `第 ${groupName} 組組聚`;
  if (title.length > 60) return "主題太長了（60 字以內）";

  return {
    title,
    date,
    time,
    location: location.slice(0, 120),
    description: String(input.description ?? "").trim().slice(0, 2000) || null,
    price,
    // 會員價跟一般價一樣就等於不分級，存 null 免得報名頁顯示兩個一樣的價錢
    member_price: memberPrice === null || memberPrice === price ? null : memberPrice,
    max_people: maxPeople && maxPeople > 0 ? maxPeople : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), {
      status: s,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const idToken = String(body?.idToken ?? "");
    const action = String(body?.action ?? "");
    if (!idToken) return json({ error: "missing_id_token" }, 401);

    const lineUserId = await verifyIdToken(idToken);
    if (!lineUserId) return json({ error: "invalid_id_token", message: "LINE 身分驗證失敗，請重新開啟" }, 401);

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: member } = await db
      .from("members")
      .select("id, name, group_name, is_group_leader, status")
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (!member || (member.status && member.status !== "active")) {
      return json({ ok: true, member: null });
    }

    // 我發起過的組聚（近 30 天到未來），附上綁定接龍的 token 與目前人數
    const myActivities = async () => {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
      const { data: acts } = await db
        .from("activities")
        .select("id, title, date, time, location, description, price, member_price, status")
        .eq("created_by_member_id", member.id)
        .gte("date", since)
        .order("date", { ascending: true });
      const ids = (acts ?? []).map((a: any) => a.id);
      if (ids.length === 0) return [];
      const { data: sheets } = await db
        .from("signup_sheets")
        .select("id, token, activity_id, max_people")
        .in("activity_id", ids);
      const sheetIds = (sheets ?? []).map((s: any) => s.id);
      const { data: entries } = sheetIds.length
        ? await db.from("signup_entries").select("sheet_id, extra_count").in("sheet_id", sheetIds)
        : { data: [] as any[] };
      return (acts ?? []).map((a: any) => {
        const sh = (sheets ?? []).find((s: any) => s.activity_id === a.id);
        const heads = sh
          ? (entries ?? []).filter((e: any) => e.sheet_id === sh.id)
              .reduce((n: number, e: any) => n + 1 + (e.extra_count ?? 0), 0)
          : 0;
        return { ...a, signup_token: sh?.token ?? null, max_people: sh?.max_people ?? null, head_count: heads };
      });
    };

    const profile = {
      id: member.id,
      name: member.name,
      group_name: member.group_name,
      is_group_leader: !!member.is_group_leader,
    };

    if (action === "me") {
      return json({
        ok: true,
        member: profile,
        activities: member.is_group_leader ? await myActivities() : [],
      });
    }

    // 以下都要是小組長
    if (!member.is_group_leader) {
      return json({ error: "not_leader", message: "只有小組長可以發起組聚，請聯絡幹部開通" }, 403);
    }
    if (!member.group_name) {
      return json({ error: "no_group", message: "你的會員資料還沒有設定組別，請聯絡幹部" }, 400);
    }

    if (action === "create") {
      const f = clean(body?.activity ?? {}, member.group_name);
      if (typeof f === "string") return json({ error: "invalid", message: f }, 400);
      // 接龍截止時間預設等於活動開始時間，過去的時間一建好就已經截止
      if (new Date(taipeiIso(f.date, f.time)).getTime() <= Date.now()) {
        return json({ error: "invalid", message: "活動時間已經過了，請確認日期" }, 400);
      }

      const { data: act, error: actErr } = await db
        .from("activities")
        .insert([{
          title: f.title,
          date: f.date,
          time: f.time,
          location: f.location,
          description: f.description,
          price: f.price,
          member_price: f.member_price,
          type: GROUP_MEETING,
          status: "active",
          created_by_member_id: member.id,
          host_group: member.group_name,
        }])
        .select("id")
        .single();
      if (actErr) return json({ error: "create_failed", message: actErr.message }, 500);

      const { data: sheet, error: sheetErr } = await db
        .from("signup_sheets")
        .insert([{
          title: f.title,
          description: f.description,
          activity_id: act.id,
          // 截止時間預設為活動開始時間
          deadline: taipeiIso(f.date, f.time),
          max_people: f.max_people,
          fee: f.price,
          member_fee: f.member_price,
          allow_guests: true,
          allow_non_members: true,
          created_by: `LINE:${member.name}`,
        }])
        .select("token")
        .single();
      if (sheetErr) {
        // 接龍建不起來就把活動收回，免得官網上出現一場沒辦法報名的組聚
        await db.from("activities").delete().eq("id", act.id);
        return json({ error: "create_failed", message: sheetErr.message }, 500);
      }

      return json({ ok: true, activity_id: act.id, signup_token: sheet.token });
    }

    // update / cancel：只能動自己發起的
    const activityId = Number(body?.activityId);
    if (!Number.isFinite(activityId)) return json({ error: "missing_activity_id" }, 400);
    const { data: own } = await db
      .from("activities")
      .select("id, created_by_member_id")
      .eq("id", activityId)
      .maybeSingle();
    if (!own || own.created_by_member_id !== member.id) {
      return json({ error: "forbidden", message: "只能修改自己發起的組聚" }, 403);
    }

    if (action === "update") {
      const f = clean(body?.activity ?? {}, member.group_name);
      if (typeof f === "string") return json({ error: "invalid", message: f }, 400);
      const { error: e1 } = await db.from("activities").update({
        title: f.title, date: f.date, time: f.time, location: f.location,
        description: f.description, price: f.price, member_price: f.member_price,
      }).eq("id", activityId);
      if (e1) return json({ error: "update_failed", message: e1.message }, 500);
      // 接龍 token 不變，已貼出去的連結照樣有效
      await db.from("signup_sheets").update({
        title: f.title, description: f.description,
        deadline: taipeiIso(f.date, f.time), max_people: f.max_people,
        fee: f.price, member_fee: f.member_price,
      }).eq("activity_id", activityId);
      return json({ ok: true });
    }

    if (action === "cancel") {
      // 不刪除，改成 closed：已報名的名單留著，幹部要對帳或通知時還查得到
      await db.from("activities").update({ status: "closed" }).eq("id", activityId);
      await db.from("signup_sheets").update({ status: "closed" }).eq("activity_id", activityId);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("leader-activity error:", e);
    return json({ error: "unexpected", message: String((e as Error)?.message ?? e) }, 500);
  }
});
