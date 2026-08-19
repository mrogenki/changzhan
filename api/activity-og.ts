/**
 * 活動詳情頁的動態 OG tags（Vercel Serverless Function）
 *
 * 為什麼需要：本站是 SPA，index.html 的 OG tags 是寫死的預設值，
 * 把 /activity/:id 貼到 LINE / Facebook 時預覽只會顯示分會的通用標題與 logo。
 * 爬蟲不執行 JS，所以必須在伺服器端把該場活動的標題／時間地點／圖片塞進 HTML。
 *
 * 怎麼接上：vercel.json 把 /activity/:id rewrite 到 /api/activity-og?id=:id，
 * 這支函式讀出 build 好的 index.html、換掉 head 裡的 OG 標籤後原樣吐回，
 * 一般使用者拿到的仍是完整的 SPA（同一份 index.html，只有 meta 不同）。
 *
 * 失敗一律 fallback 成原本的 index.html：預覽圖不對只是不好看，
 * 活動頁打不開才是真的壞掉。
 */

import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qxoglhkfxxqsjefynzqn.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4b2dsaGtmeHhxc2plZnluenFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzQwNTAsImV4cCI6MjA4NTYxMDA1MH0.gLvcHgY0rqLd26Nw61_M7nmjaz4TUsP9VL-XxN5wNSU';

const DEFAULT_IMAGE =
  'https://qxoglhkfxxqsjefynzqn.supabase.co/storage/v1/object/public/activity-images/changzhan-logo.jpg';

const esc = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// 讀 build 產物；Vercel 上由 vercel.json 的 includeFiles 帶進函式，本機則直接讀 dist/
function readTemplateFromDisk(): string | null {
  for (const p of [
    path.join(process.cwd(), 'dist', 'index.html'),
    path.join(process.cwd(), 'index.html'),
  ]) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
    } catch {
      // 換下一個路徑
    }
  }
  return null;
}

// 檔案讀不到時的備援：直接跟自己的網域要靜態 index.html
async function fetchTemplate(host: string): Promise<string | null> {
  try {
    const res = await fetch(`https://${host}/index.html`, { headers: { accept: 'text/html' } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// 用 activity_og view 而不是 activities：view 已在 DB 端把非網址的 picture 濾成 null。
// 早期活動的 picture 是 200KB 的 base64，整包拉下來曾讓冷啟動時撈資料逾時。
async function fetchActivity(id: string) {
  const url =
    `${SUPABASE_URL}/rest/v1/activity_og` +
    `?id=eq.${encodeURIComponent(id)}&select=title,date,time,location,picture&limit=1`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch {
    return null; // 逾時或失敗就用預設值，不要讓活動頁開不起來
  } finally {
    clearTimeout(timer);
  }
}

function injectOg(
  html: string,
  meta: { title: string; description: string; image: string; url: string }
): string {
  let out = html;
  const setProp = (prop: string, content: string) => {
    const re = new RegExp(`(<meta\\s+property="${prop}"\\s+content=")[^"]*(")`, 'i');
    if (re.test(out)) out = out.replace(re, `$1${esc(content)}$2`);
  };

  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(meta.title)}</title>`);
  out = out.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/i,
    `$1${esc(meta.description)}$2`
  );

  setProp('og:title', meta.title);
  setProp('og:description', meta.description);
  setProp('og:image', meta.image);
  setProp('twitter:title', meta.title);
  setProp('twitter:description', meta.description);
  setProp('twitter:image', meta.image);

  // index.html 沒有 og:url，補一個進去
  if (/property="og:url"/i.test(out)) {
    setProp('og:url', meta.url);
  } else {
    out = out.replace(
      /(<meta\s+property="og:type"[^>]*>)/i,
      `$1\n    <meta property="og:url" content="${esc(meta.url)}">`
    );
  }
  return out;
}

export default async function handler(req: any, res: any) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'changzhan.vercel.app';
  const rawId = req.query?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  let template = readTemplateFromDisk();
  if (!template) template = await fetchTemplate(String(host));
  if (!template) {
    // 連 app shell 都拿不到就別硬撐，讓使用者重整比吐半殘的頁面好
    res.status(502).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><meta charset="utf-8"><p>頁面暫時無法載入，請稍後重試。</p>');
    return;
  }

  let html = template;
  const activity = id ? await fetchActivity(String(id)) : null;
  if (activity) {
    const picture = activity.picture || DEFAULT_IMAGE;
    const parts = [activity.date, activity.time].filter(Boolean).join(' ');
    const description = [parts, activity.location ? `地點：${activity.location}` : '']
      .filter(Boolean)
      .join(' | ') || '立即報名參加 BNI 長展分會的商務例會與精選活動。';
    html = injectOg(html, {
      title: `${activity.title} - 長展分會活動報名`,
      description,
      image: picture,
      url: `https://${host}/activity/${id}`,
    });
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // 撈到活動才長快取；沒撈到（查無此活動，或撈取失敗退回預設 OG）只快取 30 秒，
  // 免得一次逾時就讓錯的預覽在 CDN 上黏 5 分鐘。
  res.setHeader(
    'Cache-Control',
    activity
      ? 'public, s-maxage=300, stale-while-revalidate=3600'
      : 'public, s-maxage=30, stale-while-revalidate=60'
  );
  res.end(html);
}
