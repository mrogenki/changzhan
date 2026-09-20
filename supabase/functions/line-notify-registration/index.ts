// supabase/functions/line-notify-registration/index.ts
// 有人報名活動後，推播通知到 app_settings 裡設定的「幹部群」
//
// Body:
//   { registrationId: number }
//
// 設計原則:
//   - 失敗不反映到使用者 (不要造成報名動作本身失敗)
//   - app_settings.line_notify_registration_group_id 為空 → 静默跳過
//   - 群組 inactive → 静默跳過 (寫 log 記錄)
//
// 需要 secrets: LINE_CHANNEL_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, skipped: true, reason: "token not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { registrationId } = await req.json();
    if (!registrationId || typeof registrationId !== "number") {
      return new Response(JSON.stringify({ error: "Missing registrationId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) 讀設定
    const { data: settingRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "line_notify_registration_group_id")
      .maybeSingle();
    const targetGroupId = settingRow?.value?.trim();
    if (!targetGroupId) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "no target group configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) 讀 群組 (確認 active)
    const { data: groupRow } = await supabase
      .from("line_groups")
      .select("id, is_active, name")
      .eq("line_group_id", targetGroupId)
      .maybeSingle();
    if (!groupRow?.is_active) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "target group inactive or not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) 讀 registration + activity
    const { data: reg, error: regErr } = await supabase
      .from("registrations")
      .select("id, name, phone, company, title, referrer, activityId")
      .eq("id", registrationId)
      .maybeSingle();
    if (regErr || !reg) {
      return new Response(
        JSON.stringify({ ok: false, error: regErr?.message ?? "registration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: activity } = await supabase
      .from("activities")
      .select("id, title, date, time, location")
      .eq("id", reg.activityId)
      .maybeSingle();

    // 4) 組訊息
    const lines = [
      "🔔 有新報名！",
      activity ? `活動：${activity.title}` : `活動 ID: ${reg.activityId}`,
      activity?.date ? `日期：${activity.date}${activity.time ? " " + activity.time : ""}` : null,
      activity?.location ? `地點：${activity.location}` : null,
      "─".repeat(12),
      `姓名：${reg.name ?? "-"}`,
      reg.company ? `公司：${reg.company}${reg.title ? " / " + reg.title : ""}` : null,
      reg.phone ? `電話：${reg.phone}` : null,
      reg.referrer ? `介紹人：${reg.referrer}` : null,
    ].filter(Boolean);
    const text = lines.join("\n");

    // 5) 推播
    let sendOk = false;
    let errMsg = "";
    try {
      const lineRes = await fetch(LINE_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: targetGroupId,
          messages: [{ type: "text", text }],
        }),
      });
      if (lineRes.ok) {
        sendOk = true;
      } else {
        errMsg = `LINE API ${lineRes.status}: ${await lineRes.text()}`;
      }
    } catch (e: any) {
      errMsg = e?.message ?? String(e);
    }

    // 6) 寫 log
    const messageHash = await sha256Hex(text);
    await supabase.from("message_send_log").insert({
      recipient_kind: "group",
      recipient_id: groupRow.id,
      line_user_id: targetGroupId,
      message_text: text,
      message_hash: messageHash,
      status: sendOk ? "sent" : "failed",
      error_message: errMsg || null,
      sent_by: "system:registration",
      batch_id: `reg_${registrationId}`,
    });

    return new Response(
      JSON.stringify({ ok: sendOk, error: errMsg || undefined, groupId: targetGroupId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("line-notify-registration error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
