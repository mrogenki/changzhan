// 會員電子名片 — LINE Flex Message builder
//
// 產生可透過 liff.shareTargetPicker() 分享，或經 send-line-message / line-broadcast
// edge function 推播的 flex 訊息。單張用 bubble，整組用 carousel。

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
  const subtitleParts = [m.company_title, m.company]
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
          : `BNI 長展分會會員名片（${used.length} 位）`,
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
 * LINE 限制：carousel 每則上限 12 bubble、shareTargetPicker 一次上限 5 則。
 * 故最多 12 × 5 = 60 位；超過回傳截斷數。
 */
export function buildMemberShareMessages(members: MemberCardData[]): {
  messages: any[];
  truncated: number;
} {
  const PER_MSG = 12;
  const MAX_MSG = 5;
  const cap = PER_MSG * MAX_MSG;
  const used = members.slice(0, cap);
  const truncated = members.length - used.length;

  const messages: any[] = [];
  for (let i = 0; i < used.length; i += PER_MSG) {
    const chunk = used.slice(i, i + PER_MSG);
    messages.push(
      chunk.length === 1
        ? buildMemberCardMessage(chunk[0])
        : {
            type: 'flex',
            altText: `BNI 長展分會會員名片（${used.length} 位）`,
            contents: {
              type: 'carousel',
              contents: chunk.map(buildMemberCardBubble),
            },
          }
    );
  }
  return { messages, truncated };
}
