// supabase/functions/telegram-notify/index.ts
// 報名通知改送 Telegram（原本送 LINE 群組，太吃推播額度）
//
// Telegram 的 Bot API 沒有訊息則數限制，所以這類「通知幹部」的推播搬過來，
// LINE 的額度留給真正要觸及會員與來賓的訊息。
//
// action:
//   （不帶）→ notify：{ registrationId } 報名通知。公開報名流程會呼叫，
//              所以不能要求登入；但訊息內容一律由伺服器從 DB 組，
//              呼叫端無法指定收件人或內容，不會被拿去當免費發送管道。
//   probe   → 列出這個 bot 最近收到訊息的聊天室與其 chat id（設定時用）
//   test    → 送一則測試訊息到目前設定的 chat
//   probe 與 test 需要後台人員身分。
//
// 必要 secret：TELEGRAM_BOT_TOKEN（Supabase Dashboard → Edge Functions → Secrets）
// chat id 存在 app_settings.telegram_notify_chat_id，後台可改。

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CHAT_ID_KEY = "telegram_notify_chat_id";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const tgUrl = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;

/** Telegram 的 HTML 模式只吃少數標籤，其餘要跳脫 */
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "notify");

    // ---- 需要後台身分的動作 ----
    if (action === "probe" || action === "test") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const asUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
      );
      const { data: { user } } = await asUser.auth.getUser();
      const email = user?.email?.toLowerCase();
      if (!email) return json({ error: "unauthorized" }, 401);
      const { data: admin } = await db.from("admins").select("id").ilike("email", email).maybeSingle();
      if (!admin) return json({ error: "forbidden", message: "只有後台人員可以做這個操作" }, 403);
    }

    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) {
      // 還沒設定就安靜跳過：報名已經寫進 DB 了，不該因為通知沒設定而看起來失敗
      if (action === "notify") {
        await db.from("notification_log").insert({
          channel: "telegram", status: "skipped", error_message: "TELEGRAM_BOT_TOKEN 未設定",
          ref: body?.registrationId ? `reg_${body.registrationId}` : null,
        });
        return json({ ok: true, skipped: "no_bot_token" });
      }
      return json({ ok: false, error: "no_bot_token", message: "尚未設定 TELEGRAM_BOT_TOKEN" }, 400);
    }

    if (action === "probe") {
      // bot 只看得到「加進聊天室之後」收到的訊息，所以要先在群組裡隨便發一則
      const res = await fetch(tgUrl(token, "getUpdates"));
      const data = await res.json();
      if (!data?.ok) return json({ ok: false, error: data?.description ?? "getUpdates 失敗" }, 502);
      const seen = new Map<string, { chat_id: string; title: string; type: string }>();
      for (const u of data.result ?? []) {
        const chat = u?.message?.chat ?? u?.channel_post?.chat ?? u?.my_chat_member?.chat;
        if (!chat?.id) continue;
        seen.set(String(chat.id), {
          chat_id: String(chat.id),
          title: chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(" ") ?? "",
          type: chat.type ?? "",
        });
      }
      return json({ ok: true, chats: [...seen.values()] });
    }

    // ---- 取得目標 chat ----
    const { data: setting } = await db.from("app_settings").select("value").eq("key", CHAT_ID_KEY).maybeSingle();
    const chatId = setting?.value?.trim();
    if (!chatId) {
      if (action === "notify") {
        await db.from("notification_log").insert({
          channel: "telegram", status: "skipped", error_message: "尚未設定 chat id",
          ref: body?.registrationId ? `reg_${body.registrationId}` : null,
        });
        return json({ ok: true, skipped: "no_chat_id" });
      }
      return json({ ok: false, error: "no_chat_id", message: "尚未設定要通知哪個 Telegram 聊天室" }, 400);
    }

    // ---- 組訊息 ----
    let text: string;
    let ref: string | null = null;

    if (action === "test") {
      text = "🔔 這是一則測試訊息，報名通知會送到這裡。";
    } else {
      const registrationId = body?.registrationId;
      if (!registrationId) return json({ error: "missing_registration_id" }, 400);
      ref = `reg_${registrationId}`;

      const { data: reg } = await db.from("registrations")
        .select('id, name, phone, company, title, referrer, "activityId"')
        .eq("id", registrationId).maybeSingle();
      if (!reg) return json({ ok: false, error: "registration_not_found" }, 404);

      const { data: activity } = await db.from("activities")
        .select("id, title, date, time, location")
        .eq("id", reg.activityId).maybeSingle();

      // 同一場活動目前累計幾筆報名——幹部最常追問的就是這個
      const { count } = await db.from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("activityId", reg.activityId);

      text = [
        "🔔 <b>有新報名！</b>",
        activity ? `活動：${esc(activity.title)}` : `活動 ID：${esc(reg.activityId)}`,
        activity?.date ? `日期：${esc(activity.date)}${activity.time ? " " + esc(activity.time) : ""}` : null,
        activity?.location ? `地點：${esc(activity.location)}` : null,
        "───────────",
        `姓名：${esc(reg.name ?? "-")}`,
        reg.company ? `公司：${esc(reg.company)}${reg.title ? " / " + esc(reg.title) : ""}` : null,
        reg.phone ? `電話：${esc(reg.phone)}` : null,
        reg.referrer ? `介紹人：${esc(reg.referrer)}` : null,
        count ? `\n這場目前共 <b>${count}</b> 人報名` : null,
      ].filter(Boolean).join("\n");
    }

    // ---- 送出 ----
    let ok = false;
    let errMsg = "";
    try {
      const res = await fetch(tgUrl(token, "sendMessage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
      const data = await res.json();
      ok = !!data?.ok;
      if (!ok) errMsg = `Telegram API: ${data?.description ?? res.status}`;
    } catch (e) {
      errMsg = (e as Error)?.message ?? String(e);
    }

    await db.from("notification_log").insert({
      channel: "telegram", target: chatId, message_text: text,
      status: ok ? "sent" : "failed", error_message: errMsg || null, ref,
    });

    // 報名通知失敗不回 4xx/5xx：報名本身已經成功，不該讓前端看起來像出錯
    return json({ ok, error: errMsg || undefined }, action === "notify" ? 200 : (ok ? 200 : 502));
  } catch (err) {
    console.error("telegram-notify error:", err);
    return json({ ok: false, error: (err as Error)?.message ?? String(err) }, 500);
  }
});
