// supabase/functions/send-line-message/index.ts
// 升級版: 支援單發 / 群發 + 自動寫 log + 防呆檢查

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const LINE_API_URL = "https://api.line.me/v2/bot/message/push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  kind: "member" | "guest";
  id: number;
  lineUserId: string;
}

interface RequestBody {
  // 模式 A: 舊版單發
  to?: string;
  // 模式 B: 新版多收件人
  recipients?: Recipient[];
  messages: Array<{ type: "text"; text: string }>;
  force?: boolean;     // 跳過 dedup 檢查
  sentBy?: string;     // admin 名稱
  batchId?: string;    // 群發共用
}

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
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
        JSON.stringify({ error: "LINE_CHANNEL_ACCESS_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Supabase service role for log writes & dedup checks
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: RequestBody = await req.json();

    if (!body.messages || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing 'messages'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 統一收件人格式
    let recipients: Recipient[] = [];
    if (body.recipients && body.recipients.length > 0) {
      recipients = body.recipients;
    } else if (body.to) {
      // 舊版相容: 單發但沒帶 kind/id (例如測試訊息),記為 unknown
      recipients = [{ kind: "guest", id: 0, lineUserId: body.to }];
    } else {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'recipients'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 訊息合併成單一字串用於 hash
    const fullText = body.messages.map(m => m.text).join("\n---\n");
    const messageHash = await sha256Hex(fullText);

    const results: Array<{ recipient: Recipient; ok: boolean; error?: string; skipped?: boolean }> = [];

    for (const recipient of recipients) {
      // 防呆檢查 (除非 force=true)
      if (!body.force) {
        const { data: dup } = await supabase.rpc("check_message_recently_sent", {
          p_line_user_id: recipient.lineUserId,
          p_message_hash: messageHash,
          p_window_hours: 24,
        });
        if (dup === true) {
          results.push({
            recipient,
            ok: false,
            skipped: true,
            error: "24 小時內已發送過相同訊息",
          });
          continue;
        }
      }

      // 呼叫 LINE API
      let sendOk = false;
      let errMsg = "";
      try {
        const lineRes = await fetch(LINE_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            to: recipient.lineUserId,
            messages: body.messages,
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

      // 寫 log (跳過 id=0 的舊版測試訊息,避免外鍵髒數)
      if (recipient.id > 0) {
        await supabase.from("message_send_log").insert({
          recipient_kind: recipient.kind,
          recipient_id: recipient.id,
          line_user_id: recipient.lineUserId,
          message_text: fullText,
          message_hash: messageHash,
          status: sendOk ? "sent" : "failed",
          error_message: errMsg || null,
          sent_by: body.sentBy || null,
          batch_id: body.batchId || null,
        });
      }

      results.push({
        recipient,
        ok: sendOk,
        error: errMsg || undefined,
      });
    }

    const sent = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;

    return new Response(
      JSON.stringify({
        success: true,
        summary: { total: results.length, sent, failed, skipped },
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("Function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});