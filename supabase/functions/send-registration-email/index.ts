// supabase/functions/send-registration-email/index.ts
// 報名確認信（Resend）
//
// 為什麼要放在 edge function：Resend 的 API key 是「可以用你的帳號寄任何信」的
// 完整權限金鑰，不能像 EmailJS 的 public key 那樣塞在前端 bundle 裡。
//
// 為什麼只收 registrationId：收件地址與信件內容一律由伺服器從 DB 撈，
// 呼叫端無法指定收件人或內容，所以這支端點不會被拿去當免費的發信管道。
//
// 必要 secrets:
//   RESEND_API_KEY  — Resend 後台的 API key
//   RESEND_FROM     — 寄件者，例如 「BNI 長展分會 <noreply@你的網域>」
//                     未設定時退回 Resend 的測試寄件者，只能寄給帳號本人
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（Supabase 自動注入）

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SITE_URL = "https://changzhan.vercel.app";
// Resend 的共用測試寄件者：沒驗證自己的網域時只能寄給 Resend 帳號本人
const FALLBACK_FROM = "BNI 長展分會 <onboarding@resend.dev>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

// activities.date 是純日期字串，new Date('2026-09-15') 會被當 UTC 而差一天，
// 所以自己拆字串再用本地時間建構來算星期。
function fmtDate(date?: string | null, time?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ""));
  if (!m) return `${date ?? ""}${time ? ` ${time}` : ""}`;
  const [, y, mo, d] = m;
  const wd = WEEKDAYS[new Date(+y, +mo - 1, +d).getDay()];
  return `${+y}/${+mo}/${+d}（${wd}）${time ? ` ${time}` : ""}`;
}

function buildHtml(reg: any, activity: any, price: number): string {
  const row = (label: string, value: string) =>
    value
      ? `<tr>
           <td style="padding:8px 0;color:#9ca3af;font-size:13px;width:80px;vertical-align:top;">${esc(label)}</td>
           <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${esc(value)}</td>
         </tr>`
      : "";

  return `<!doctype html>
<html lang="zh-TW"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px 12px;background:#f9fafb;font-family:'Noto Sans TC','Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #f3f4f6;">
    <tr>
      <td style="background:#dc2626;padding:24px;text-align:center;">
        <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:1px;">BNI 長展分會</div>
        <div style="color:#fecaca;font-size:13px;margin-top:4px;">報名確認通知</div>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 24px;">
        <p style="margin:0 0 4px;font-size:16px;color:#111827;">${esc(reg.name)} 您好，</p>
        <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.7;">
          我們已收到您的報名，期待與您相見！以下是活動資訊：
        </p>

        <div style="background:#f9fafb;border-radius:12px;padding:16px 18px;">
          <div style="font-size:17px;font-weight:700;color:#111827;margin-bottom:10px;">${esc(activity.title)}</div>
          <table role="presentation" style="width:100%;border-collapse:collapse;">
            ${row("日期時間", fmtDate(activity.date, activity.time))}
            ${row("地點", activity.location ?? "")}
            ${price > 0 ? row("費用", `NT$ ${price.toLocaleString("zh-TW")}`) : ""}
          </table>
        </div>

        <div style="margin-top:20px;">
          <div style="font-size:12px;color:#9ca3af;font-weight:700;letter-spacing:1px;margin-bottom:8px;">您的報名資料</div>
          <table role="presentation" style="width:100%;border-collapse:collapse;">
            ${row("姓名", reg.name)}
            ${row("電話", reg.phone ?? "")}
            ${row("公司", reg.company ?? "")}
            ${row("職稱", reg.title ?? "")}
            ${row("引薦人", reg.referrer ?? "")}
          </table>
        </div>

        <div style="text-align:center;margin-top:28px;">
          <a href="${SITE_URL}/activity/${esc(activity.id)}"
             style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:12px;font-weight:700;font-size:14px;">
            查看活動詳情
          </a>
        </div>

        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.7;">
          若資料有誤或需要取消報名，請直接回覆本信或聯繫分會幹部。
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb;padding:16px;text-align:center;color:#9ca3af;font-size:12px;">
        BNI 長展分會 · <a href="${SITE_URL}" style="color:#9ca3af;">${SITE_URL.replace("https://", "")}</a>
      </td>
    </tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), {
      status: s,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 寄信結果一律留一筆，避免「沒寄出也沒人知道」
  const log = async (row: Record<string, unknown>) => {
    const { error } = await supabase.from("email_send_log").insert([row]);
    if (error) console.error("email_send_log insert failed:", error.message);
  };

  try {
    const body = await req.json().catch(() => ({}));
    const registrationId = body?.registrationId;
    if (!registrationId) return json({ error: "missing_registration_id" }, 400);

    const { data: reg, error: regErr } = await supabase
      .from("registrations")
      .select("id, name, email, phone, company, title, referrer, \"activityId\"")
      .eq("id", registrationId)
      .maybeSingle();
    if (regErr) return json({ error: "lookup_failed", message: regErr.message }, 500);
    if (!reg) return json({ error: "registration_not_found" }, 404);

    const to = String(reg.email ?? "").trim();
    // 代為報名允許不填 email（DB 是 NOT NULL，前端補空字串）
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      await log({
        registration_id: reg.id,
        to_email: to || "(空)",
        status: "skipped",
        error_message: "沒有有效的 email",
      });
      return json({ ok: true, skipped: "no_email" });
    }

    const { data: activity } = await supabase
      .from("activities")
      .select("id, title, date, time, location, price, member_price")
      .eq("id", reg.activityId)
      .maybeSingle();
    if (!activity) return json({ error: "activity_not_found" }, 404);

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      // 還沒設 key 時不要讓報名流程看起來壞掉，記一筆就好
      console.warn("RESEND_API_KEY 未設定，跳過寄信");
      await log({
        registration_id: reg.id,
        to_email: to,
        status: "skipped",
        error_message: "RESEND_API_KEY 未設定",
      });
      return json({ ok: true, skipped: "no_api_key" });
    }

    // 公開報名頁顯示的是一般價；會員價要登入才判斷得出來，這裡不猜
    const price = Number(activity.price) || 0;
    const subject = `【報名確認】${activity.title}`;

    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM") || FALLBACK_FROM,
        to: [to],
        subject,
        html: buildHtml(reg, activity, price),
      }),
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = payload?.message ?? `Resend ${res.status}`;
      console.error("Resend 寄送失敗:", msg);
      await log({
        registration_id: reg.id,
        to_email: to,
        subject,
        status: "failed",
        error_message: String(msg).slice(0, 500),
      });
      // 報名已經成功，寄信失敗不該讓前端顯示成報名失敗
      return json({ ok: false, error: "send_failed", message: msg }, 200);
    }

    await log({
      registration_id: reg.id,
      to_email: to,
      subject,
      status: "sent",
      provider_id: payload?.id ?? null,
    });
    return json({ ok: true, id: payload?.id ?? null });
  } catch (e) {
    console.error("send-registration-email error:", e);
    return json({ error: "unexpected", message: String((e as Error)?.message ?? e) }, 500);
  }
});
