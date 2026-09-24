// 會員電子名片 — LINE Flex Message builder
//
// 產生可透過 liff.shareTargetPicker() 分享，或經 send-line-message / line-broadcast
// edge function 推播的 flex 訊息。單張用 bubble，整組用 carousel。

import { CHAPTER_FULL_NAME, LIFF_CARD_ID } from '../chapterConfig';

/** 名片所需欄位（對應 public_member_cards RPC 回傳） */
export interface MemberCardData {
  id: number;
  name: string;
  company?: string | null;
  company_title?: string | null;
  industry_chain?: string | null;
  industry_category?: string | null;
  picture?: string | null;
  website?: string | null;
  mobile_phone?: string | null;
  email?: string | null;
  intro?: string | null;
}

const BNI_RED = '#C8102E';
const GOLD = '#B08D57';
// 找不到大頭照時的預設圖（LINE flex 的 image 需可公開存取的 https）
const PLACEHOLDER_IMG =
  'https://placehold.co/600x600/f3f4f6/9ca3af/png?text=BNI';

/** 補齊網址協定：沒有 http(s) 前綴時自動補 https:// */
function normalizeUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** 電話轉成 tel: URI，只保留數字與開頭的 + */
function telUri(phone?: string | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^0-9+]/g, '');
  return cleaned ? `tel:${cleaned}` : null;
}

/** LINE flex image 只吃 https；http 或空值一律用 placeholder */
function safeImageUrl(url?: string | null): string {
  const normalized = (url ?? '').trim();
  if (/^https:\/\//i.test(normalized)) return normalized;
  return PLACEHOLDER_IMG;
}

function textOrDash(v?: string | null): string {
  const t = (v ?? '').trim();
  return t || ' ';
}

/**
 * 單張名片 bubble。
 * 版型：大頭照(hero) → 產業別/姓名/職稱·公司/簡介 → 底部按鈕（電話 / 官網 / 寫信）
 */
export function buildMemberCardBubble(m: MemberCardData): any {
  const subtitleParts = [m.company, m.company_title]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  const subtitle = subtitleParts.join(' · ');

  const bodyContents: any[] = [];

  if ((m.industry_category ?? '').trim()) {
    bodyContents.push({
      type: 'text',
      text: textOrDash(m.industry_category),
      size: 'xs',
      color: GOLD,
      weight: 'bold',
    });
  }

  bodyContents.push({
    type: 'text',
    text: textOrDash(m.name),
    size: 'xl',
    weight: 'bold',
    wrap: true,
    color: '#111111',
  });

  if (subtitle) {
    bodyContents.push({
      type: 'text',
      text: subtitle,
      size: 'sm',
      color: '#666666',
      wrap: true,
    });
  }

  if ((m.intro ?? '').trim()) {
    bodyContents.push({
      type: 'text',
      text: m.intro!.trim(),
      size: 'sm',
      color: '#888888',
      wrap: true,
      margin: 'md',
      maxLines: 4,
    });
  }

  // 底部按鈕：只放有資料的
  const footerContents: any[] = [];

  const tel = telUri(m.mobile_phone);
  if (tel) {
    footerContents.push({
      type: 'button',
      style: 'primary',
      color: BNI_RED,
      height: 'sm',
      action: { type: 'uri', label: '撥打電話', uri: tel },
    });
  }

  const site = normalizeUrl(m.website);
  if (site) {
    footerContents.push({
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: { type: 'uri', label: '看官網', uri: site },
    });
  }

  const email = (m.email ?? '').trim();
  if (email) {
    footerContents.push({
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: { type: 'uri', label: '寫信給我', uri: `mailto:${email}` },
    });
  }

  // 「分享這張名片」：收到名片的人可以直接往外轉傳。
  // 帶去的是 LIFF 名片頁（?member=<id>），那頁本來就會預覽 + shareTargetPicker，
  // 所以訊息是由轉傳的人自己送出的，不吃 OA 推播額度。
  if (LIFF_CARD_ID && m.id) {
    footerContents.push({
      type: 'button',
      style: 'link',
      height: 'sm',
      action: {
        type: 'uri',
        label: '分享這張名片',
        uri: `https://liff.line.me/${LIFF_CARD_ID}?member=${m.id}`,
      },
    });
  }

  const bubble: any = {
    type: 'bubble',
    hero: {
      type: 'image',
      url: safeImageUrl(m.picture),
      size: 'full',
      aspectRatio: '1:1',
      aspectMode: 'cover',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: bodyContents,
    },
  };

  if (footerContents.length > 0) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: footerContents,
    };
  }

  return bubble;
}

/** 單張名片訊息物件（可直接丟進 shareTargetPicker / messages 陣列） */
export function buildMemberCardMessage(m: MemberCardData): any {
  const company = (m.company ?? '').trim();
  return {
    type: 'flex',
    altText: `${m.name}的電子名片${company ? ` — ${company}` : ''}`,
    contents: buildMemberCardBubble(m),
  };
}

/**
 * 多張名片 carousel 訊息（一次發整組）。
 * LINE carousel 上限 12 個 bubble；超過會自動截斷並回傳被截斷的數量。
 */
export function buildMemberCarouselMessage(members: MemberCardData[]): {
  message: any;
  truncated: number;
} {
  const MAX = 12;
  const used = members.slice(0, MAX);
  const truncated = members.length - used.length;
  return {
    message: {
      type: 'flex',
      altText:
        used.length === 1
          ? `${used[0].name}的電子名片`
          : `${CHAPTER_FULL_NAME}會員名片（${used.length} 位）`,
      contents: {
        type: 'carousel',
        contents: used.map(buildMemberCardBubble),
      },
    },
    truncated,
  };
}

/**
 * 把多位會員拆成多則訊息一次分享。
 *
 * LINE 的限制有兩條，**兩條都會擋**：
 *   · carousel 每則上限 12 bubble
 *   · **每則 flex 訊息的 JSON 上限 10 KB**
 *
 * ⚠️ 原本只按「12 張一則」切，沒看大小。實測真實會員資料**9 張就 9.3 KB**，
 *    12 張必定超過 10 KB 而被 LINE 拒收（簡介長、照片網址長的人尤其吃空間）。
 *    所以改成邊塞邊量，超過預算就換下一則。
 */
const BUBBLE_LIMIT = 12;      // LINE 的 carousel 上限
const BYTE_BUDGET = 9000;     // 留 1KB 緩衝給 altText 與序列化差異
const MAX_MSG = 5;            // shareTargetPicker 一次最多 5 則

export function buildMemberShareMessages(members: MemberCardData[]): {
  messages: any[];
  truncated: number;
} {
  const wrap = (chunk: MemberCardData[], bubbles: any[]) =>
    chunk.length === 1
      ? buildMemberCardMessage(chunk[0])
      : {
          type: 'flex',
          altText: `${CHAPTER_FULL_NAME}會員名片（${chunk.length} 位）`,
          contents: { type: 'carousel', contents: bubbles },
        };

  const messages: any[] = [];
  let chunk: MemberCardData[] = [];
  let bubbles: any[] = [];
  let used = 0;

  const flush = () => {
    if (chunk.length === 0) return;
    messages.push(wrap(chunk, bubbles));
    chunk = [];
    bubbles = [];
  };

  for (const m of members) {
    if (messages.length >= MAX_MSG) break;
    const bubble = buildMemberCardBubble(m);
    const nextBubbles = [...bubbles, bubble];
    const tooBig = JSON.stringify(wrap([...chunk, m], nextBubbles)).length > BYTE_BUDGET;

    if (chunk.length > 0 && (tooBig || nextBubbles.length > BUBBLE_LIMIT)) {
      flush();
      if (messages.length >= MAX_MSG) break;
    }
    chunk.push(m);
    bubbles.push(bubble);
    used++;
  }
  flush();

  // 超出 5 則放不下的部分
  return { messages: messages.slice(0, MAX_MSG), truncated: Math.max(0, members.length - used) };
}
