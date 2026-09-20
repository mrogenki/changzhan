// supabase/functions/line-quota/index.ts
// 查詢 LINE Messaging API 本月推播額度 / 已使用量
//
// LINE Docs:
//   GET /v2/bot/message/quota              → { type: 'limited'|'none', value: number }
//   GET /v2/bot/message/quota/consumption  → { totalUsage: number }
//
// Response:
//   {
//     type: 'limited'|'none',     // none = 無限 (中高用量方案可能)
//     limit: number | null,        // type=limited 才有值
//     used: number,                // 本月已使用
//     remaining: number | null     // limit 有值才計算
//   }
//
// 需要 secret: LINE_CHANNEL_ACCESS_TOKEN

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "LINE_CHANNEL_ACCESS_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const auth = { Authorization: `Bearer ${token}` };

    const [quotaRes, usageRes] = await Promise.all([
      fetch("https://api.line.me/v2/bot/message/quota", { headers: auth }),
      fetch("https://api.line.me/v2/bot/message/quota/consumption", { headers: auth }),
    ]);

    if (!quotaRes.ok) {
      const t = await quotaRes.text();
      return new Response(
        JSON.stringify({ error: `quota API ${quotaRes.status}: ${t}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!usageRes.ok) {
      const t = await usageRes.text();
      return new Response(
        JSON.stringify({ error: `consumption API ${usageRes.status}: ${t}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const quota = await quotaRes.json();   // { type, value }
    const usage = await usageRes.json();   // { totalUsage }

    const type: "limited" | "none" = quota?.type ?? "limited";
    const limit: number | null = type === "limited" ? Number(quota?.value ?? 0) : null;
    const used: number = Number(usage?.totalUsage ?? 0);
    const remaining: number | null = limit === null ? null : Math.max(0, limit - used);

    return new Response(
      JSON.stringify({ type, limit, used, remaining }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("line-quota error:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
