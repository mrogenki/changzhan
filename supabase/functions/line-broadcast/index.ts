// supabase/functions/line-broadcast/index.ts
// 同時推播一段訊息到多個 LINE 群組
//
// 安全：verify_jwt 只能擋住「沒帶 JWT」的請求，而 anon key 是公開的，
// 等於任何人都能對全分會群組發訊息。因此這裡改成實際驗證呼叫者：
// 必須是已登入、在 admins 表中、且 can_edit 為 true 的後台人員。
//
// Body:
//   {
//     groupIds: string[],                  // line_groups.line_group_id
//     messages: LineMessage[],             // text 或 image，最多 5 則
//     sentBy?: string,                     // admin 顯示名（寫入 message_send_log）
//     batchId?: string
//   }
//
// 需要 secrets: LINE_CHANNEL_ACCESS_TOKEN

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type LineTextMessage = { type: "text"; text: string };
type LineImageMessage = { type: "image"; originalContentUrl: string; previewImageUrl: string };
type LineMessage = LineTextMessage | LineImageMessage;

interface RequestBody {
  groupIds: string[];
  messages: LineMessage[];
  sentBy?: string;
  batchId?: string;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function summarizeMessages(messages: LineMessage[]): string {
  return messages
    .map((m) => {
      if (m.type === "text") return m.text;
      if (m.type === "image") return `[image] ${m.originalContentUrl}`;
      return JSON.stringify(m);
    })
    .join("\n---\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    if (!token) return json({ error: "LINE_CHANNEL_ACCESS_TOKEN not configured" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 驗證呼叫者：必須是可編輯的後台人員
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(jwt);
    const callerEmail = userData?.user?.email;
    if (!callerEmail) return json({ error: "unauthorized", message: "請先登入後台" }, 401);
    const { data: caller } = await supabase
      .from("admins")
      .select("id, can_edit")
      .ilike("email", callerEmail)
      .maybeSingle();
    if (!caller) return json({ error: "forbidden", message: "此帳號沒有後台權限" }, 403);
    if (caller.can_edit === false) {
      return json({ error: "forbidden", message: "你的帳號為僅檢視權限，無法發送訊息" }, 403);
    }

    const body: RequestBody = await req.json();

    if (!Array.isArray(body.groupIds) || body.groupIds.length === 0) {
      return json({ error: "Missing 'groupIds' (non-empty array)" }, 400);
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return json({ error: "Missing 'messages' (non-empty array)" }, 400);
    }
    if (body.messages.length > 5) {
      return json({ error: "LINE allows max 5 messages per push" }, 400);
    }

    const fullText = summarizeMessages(body.messages);
    const messageHash = await sha256Hex(fullText);
    const batchId =
      body.batchId ||
      `bcast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 平行推播到所有群組
    const tasks = body.groupIds.map(async (groupId) => {
      const { data: groupRow } = await supabase
        .from("line_groups")
        .select("id, is_active")
        .eq("line_group_id", groupId)
        .maybeSingle();

      if (!groupRow?.is_active) {
        return {
          groupId,
          ok: false,
          error: groupRow ? "group inactive" : "group not found",
        };
      }

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
            to: groupId,
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

      await supabase.from("message_send_log").insert({
        recipient_kind: "group",
        recipient_id: groupRow.id,
        line_user_id: groupId,
        message_text: fullText,
        message_hash: messageHash,
        status: sendOk ? "sent" : "failed",
        error_message: errMsg || null,
        sent_by: body.sentBy || null,
        batch_id: batchId,
      });

      return { groupId, ok: sendOk, error: errMsg || undefined };
    });

    const results = await Promise.all(tasks);
    const sent = results.filter((r) => r.ok).length;
    const failed = results.length - sent;

    return json({
      success: true,
      batchId,
      summary: { total: results.length, sent, failed },
      results,
    });
  } catch (err: any) {
    console.error("line-broadcast error:", err);
    return json({ success: false, error: err?.message ?? String(err) }, 500);
  }
});
