import React, { useEffect, useState } from 'react';
import liff from '@line/liff';
import { createClient } from '@supabase/supabase-js';
import {
  MemberCardData,
  buildMemberCarouselMessage,
} from '../lib/memberCard';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

// 名片專用 LIFF app（需在 LINE Console 開啟 shareTargetPicker）
const LIFF_CARD_ID = import.meta.env.VITE_LIFF_CARD_ID as string;

type Phase =
  | { kind: 'loading'; msg: string }
  | { kind: 'ready' }
  | { kind: 'sent' }
  | { kind: 'error'; msg: string };

function withTimeout<T>(promise: Promise<T>, ms: number, errMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errMsg)), ms)),
  ]);
}

/** 從 URL 解析要分享的會員 id（支援 ?member=1 或 ?ids=1,2,3，含 liff.state 包裹） */
function parseMemberIds(): number[] {
  function fromSearch(search: string): number[] {
    const p = new URLSearchParams(search);
    const single = p.get('member');
    const many = p.get('ids');
    const raw = many ?? single ?? '';
    return raw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  let ids = fromSearch(window.location.search);
  if (ids.length > 0) return ids;

  // OAuth 重導回來時參數會包在 liff.state 裡
  const state = new URLSearchParams(window.location.search).get('liff.state');
  if (state) {
    const cleaned = state.startsWith('?') ? state.substring(1) : state;
    ids = fromSearch(cleaned);
  }
  return ids;
}

export default function LiffCard() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading', msg: '初始化 LINE...' });
  const [cards, setCards] = useState<MemberCardData[]>([]);
  const [sharing, setSharing] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ids = parseMemberIds();
        if (ids.length === 0) {
          setPhase({ kind: 'error', msg: '連結不完整,找不到要分享的會員' });
          return;
        }
        if (!LIFF_CARD_ID) {
          setPhase({ kind: 'error', msg: 'LIFF 尚未設定,請聯絡管理員' });
          return;
        }

        try {
          await withTimeout(liff.init({ liffId: LIFF_CARD_ID }), 8000, 'LINE 初始化逾時');
        } catch (e: any) {
          setPhase({ kind: 'error', msg: 'LINE 初始化失敗:' + e.message });
          return;
        }

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        setPhase({ kind: 'loading', msg: '載入名片資料...' });
        const { data, error } = await supabase.rpc('public_member_cards', { p_ids: ids });
        if (error) {
          setPhase({ kind: 'error', msg: '載入失敗:' + error.message });
          return;
        }
        const list = (data ?? []) as MemberCardData[];
        if (list.length === 0) {
          setPhase({ kind: 'error', msg: '查無此會員資料' });
          return;
        }

        setCards(list);
        setCanShare(liff.isApiAvailable('shareTargetPicker'));
        setPhase({ kind: 'ready' });
      } catch (e: any) {
        setPhase({ kind: 'error', msg: '發生錯誤:' + (e?.message ?? String(e)) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleShare() {
    if (cards.length === 0) return;
    if (!liff.isApiAvailable('shareTargetPicker')) {
      alert('此環境不支援分享,請在 LINE App 內開啟本頁');
      return;
    }
    setSharing(true);
    try {
      const { message, truncated } = buildMemberCarouselMessage(cards);
      if (truncated > 0) {
        alert(`一次最多分享 12 張名片,超過的 ${truncated} 張本次不會送出`);
      }
      const res = await liff.shareTargetPicker([message]);
      // 新版 SDK：送出成功回傳物件；使用者取消則為 undefined
      if (res) {
        setPhase({ kind: 'sent' });
      }
    } catch (e: any) {
      alert('分享失敗:' + (e?.message ?? String(e)));
    } finally {
      setSharing(false);
    }
  }

  const isGroup = cards.length > 1;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {phase.kind === 'loading' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mb-4" />
            <p className="text-gray-600">{phase.msg}</p>
          </div>
        )}

        {phase.kind === 'error' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center py-12">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-red-600 font-medium">{phase.msg}</p>
          </div>
        )}

        {phase.kind === 'sent' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-xl font-bold text-green-600 mb-2">名片已送出</p>
            <p className="text-sm text-gray-500">可點右上角 ✕ 關閉,或再分享給其他人</p>
            <button
              onClick={() => setPhase({ kind: 'ready' })}
              className="mt-6 w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-bold"
            >
              再分享一次
            </button>
          </div>
        )}

        {phase.kind === 'ready' && (
          <div>
            <p className="text-center text-gray-500 mb-4 text-sm">
              {isGroup ? `以下 ${cards.length} 位會員名片` : '預覽名片'}
            </p>

            <div className="space-y-4">
              {cards.map((m) => (
                <CardPreview key={m.id} m={m} />
              ))}
            </div>

            {!canShare && (
              <p className="text-center text-xs text-amber-600 mt-4">
                目前不在 LINE App 內,無法使用分享。請從 LINE 開啟此連結。
              </p>
            )}

            <button
              onClick={handleShare}
              disabled={sharing || !canShare}
              className="mt-5 w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-red-200 disabled:opacity-50"
            >
              {sharing ? '開啟分享中...' : isGroup ? `分享這 ${cards.length} 張名片` : '分享名片'}
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">
              點擊後可選擇要傳送的好友或群組
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** 名片預覽（近似 LINE flex 呈現，讓使用者確認要送什麼） */
function CardPreview({ m }: { m: MemberCardData }) {
  const subtitle = [m.company_title, m.company]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden">
      {m.picture ? (
        <img
          src={m.picture}
          alt={m.name}
          className="w-full aspect-square object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-gray-300 text-5xl">
          BNI
        </div>
      )}
      <div className="p-5">
        {(m.industry_category ?? '').trim() && (
          <p className="text-xs font-bold" style={{ color: '#B08D57' }}>
            {m.industry_category}
          </p>
        )}
        <h2 className="text-xl font-bold text-gray-900 mt-1">{m.name}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        {(m.intro ?? '').trim() && (
          <p className="text-sm text-gray-400 mt-3 line-clamp-4 leading-relaxed">{m.intro}</p>
        )}

        <div className="mt-4 space-y-2">
          {(m.mobile_phone ?? '').trim() && (
            <div className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-bold text-center">
              撥打電話
            </div>
          )}
          {(m.website ?? '').trim() && (
            <div className="w-full py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-bold text-center">
              看官網
            </div>
          )}
          {(m.email ?? '').trim() && (
            <div className="w-full py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-bold text-center">
              寫信給我
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
