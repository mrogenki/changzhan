import React, { useEffect, useMemo, useState } from 'react';
import liff from '@line/liff';
import { createClient } from '@supabase/supabase-js';
import { Search, Check, Share2, User } from 'lucide-react';
import {
  MemberCardData,
  buildMemberShareMessages,
} from '../lib/memberCard';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

// 名片專用 LIFF app（需在 LINE Console 開啟 shareTargetPicker）
const LIFF_CARD_ID = import.meta.env.VITE_LIFF_CARD_ID as string;

const CHAINS = ['美食', '工程', '健康', '幸福', '工商'];

/** 挑選清單用（對應 public_member_directory，不含電話/email） */
interface DirMember {
  id: number;
  name: string;
  company?: string | null;
  industry_chain?: string | null;
  industry_category?: string | null;
  company_title?: string | null;
  group_name?: string | null;
  picture?: string | null;
}

type Phase =
  | { kind: 'loading'; msg: string }
  | { kind: 'preview' } // 帶參數：預覽指定會員並分享
  | { kind: 'picker' } //  無參數：多選挑選頁
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
    const raw = p.get('ids') ?? p.get('member') ?? '';
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
  const [cards, setCards] = useState<MemberCardData[]>([]); // 預覽模式：已載入的名片
  const [directory, setDirectory] = useState<DirMember[]>([]); // 挑選模式：會員清單
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [chain, setChain] = useState<string>('all');
  const [sharing, setSharing] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    (async () => {
      try {
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

        // isApiAvailable 在 iOS LINE 內建瀏覽器有時誤報 false，
        // 故只要在 LINE 內(isInClient)就允許嘗試，實際能否用交給 shareTargetPicker try/catch。
        setCanShare(liff.isInClient() || liff.isApiAvailable('shareTargetPicker'));

        const ids = parseMemberIds();

        if (ids.length > 0) {
          // 預覽模式
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
          setPhase({ kind: 'preview' });
        } else {
          // 挑選模式
          setPhase({ kind: 'loading', msg: '載入會員名單...' });
          const { data, error } = await supabase.rpc('public_member_directory');
          if (error) {
            setPhase({ kind: 'error', msg: '載入失敗:' + error.message });
            return;
          }
          const list = ((data ?? []) as any[])
            .filter((m) => !m.status || m.status === 'active')
            .map((m) => ({
              id: Number(m.id),
              name: m.name,
              company: m.company,
              industry_chain: m.industry_chain,
              industry_category: m.industry_category,
              company_title: m.company_title,
              group_name: m.group_name,
              picture: m.picture,
            })) as DirMember[];
          setDirectory(list);
          setPhase({ kind: 'picker' });
        }
      } catch (e: any) {
        setPhase({ kind: 'error', msg: '發生錯誤:' + (e?.message ?? String(e)) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 共用：把一批名片透過 shareTargetPicker 送出 */
  async function shareCards(list: MemberCardData[]) {
    if (list.length === 0) return;
    if (typeof (liff as any).shareTargetPicker !== 'function') {
      alert('此環境不支援分享,請在 LINE App 內開啟本頁');
      return;
    }
    setSharing(true);
    try {
      const { messages, truncated } = buildMemberShareMessages(list);
      if (truncated > 0) {
        alert(`一次最多分享 60 位,超過的 ${truncated} 位本次不會送出`);
      }
      const res = await liff.shareTargetPicker(messages);
      if (res) setPhase({ kind: 'sent' });
    } catch (e: any) {
      alert('分享失敗:' + (e?.message ?? String(e)));
    } finally {
      setSharing(false);
    }
  }

  /** 預覽模式分享 */
  function sharePreview() {
    shareCards(cards);
  }

  /** 挑選模式分享：依選取 id 抓完整名片欄位再送 */
  async function shareSelected() {
    if (selected.length === 0) return;
    setSharing(true);
    try {
      const { data, error } = await supabase.rpc('public_member_cards', { p_ids: selected });
      if (error) {
        alert('載入名片失敗:' + error.message);
        return;
      }
      // 依 selected 的順序排列
      const byId = new Map((data as MemberCardData[]).map((c) => [Number(c.id), c]));
      const ordered = selected.map((id) => byId.get(id)).filter(Boolean) as MemberCardData[];
      await shareCards(ordered);
    } finally {
      setSharing(false);
    }
  }

  function toggle(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return directory.filter((m) => {
      if (chain !== 'all' && m.industry_chain !== chain) return false;
      if (!q) return true;
      return [m.name, m.company, m.industry_category, m.group_name]
        .map((v) => (v ?? '').toLowerCase())
        .some((s) => s.includes(q));
    });
  }, [directory, query, chain]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* loading / error / sent 用置中容器 */}
      {(phase.kind === 'loading' || phase.kind === 'error' || phase.kind === 'sent') && (
        <div className="flex items-center justify-center p-4 min-h-screen">
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
                <p className="text-sm text-gray-500">可點右上角 ✕ 關閉,或繼續分享</p>
                <button
                  onClick={() =>
                    setPhase(directory.length > 0 ? { kind: 'picker' } : { kind: 'preview' })
                  }
                  className="mt-6 w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-bold"
                >
                  繼續分享
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 預覽模式 */}
      {phase.kind === 'preview' && (
        <div className="flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <p className="text-center text-gray-500 mb-4 text-sm">
              {cards.length > 1 ? `以下 ${cards.length} 位會員名片` : '預覽名片'}
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
              onClick={sharePreview}
              disabled={sharing || !canShare}
              className="mt-5 w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-red-200 disabled:opacity-50"
            >
              {sharing ? '開啟分享中...' : cards.length > 1 ? `分享這 ${cards.length} 張名片` : '分享名片'}
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">點擊後可選擇要傳送的好友或群組</p>
          </div>
        </div>
      )}

      {/* 挑選模式（圖文選單入口） */}
      {phase.kind === 'picker' && (
        <div className="max-w-md mx-auto pb-28">
          <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur px-4 pt-4 pb-2 border-b border-gray-100">
            <h1 className="text-lg font-bold text-gray-900 mb-1">選擇會員名片</h1>
            <p className="text-xs text-gray-400 mb-3">勾選後可一次分享整組給好友或群組</p>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋姓名 / 公司 / 行業別 / 組別"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-red-500 bg-white"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto mt-3 pb-1 -mx-1 px-1">
              <FilterChip active={chain === 'all'} onClick={() => setChain('all')}>
                全部
              </FilterChip>
              {CHAINS.map((c) => (
                <FilterChip key={c} active={chain === c} onClick={() => setChain(c)}>
                  {c}
                </FilterChip>
              ))}
            </div>
          </div>

          <div className="px-4 mt-3 space-y-2">
            {filtered.map((m) => {
              const isSel = selected.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    isSel ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                    {m.picture ? (
                      <img src={m.picture} alt={m.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User size={20} className="text-gray-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 truncate">{m.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {[m.company, m.industry_category].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isSel ? 'bg-red-600 text-white' : 'border-2 border-gray-300'
                    }`}
                  >
                    {isSel && <Check size={14} strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-12">找不到符合的會員</p>
            )}
          </div>

          {/* 底部固定分享列 */}
          <div className="fixed bottom-0 inset-x-0 z-20">
            <div className="max-w-md mx-auto p-4 bg-white/95 backdrop-blur border-t border-gray-100">
              {!canShare && (
                <p className="text-center text-xs text-amber-600 mb-2">
                  請從 LINE App 內開啟才能分享
                </p>
              )}
              <button
                onClick={shareSelected}
                disabled={sharing || !canShare || selected.length === 0}
                className="w-full bg-red-600 text-white py-3.5 rounded-xl font-bold text-lg shadow-lg shadow-red-200 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Share2 size={18} />
                {sharing
                  ? '開啟分享中...'
                  : selected.length === 0
                  ? '請先勾選會員'
                  : `分享 ${selected.length} 位名片`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
        active ? 'bg-red-600 text-white' : 'bg-white border border-gray-200 text-gray-500'
      }`}
    >
      {children}
    </button>
  );
}

/** 名片預覽（近似 LINE flex 呈現，讓使用者確認要送什麼） */
function CardPreview({ m }: { m: MemberCardData }) {
  const subtitle = [m.company, m.company_title]
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
            <a
              href={`tel:${m.mobile_phone!.replace(/[^0-9+]/g, '')}`}
              className="block w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-bold text-center active:opacity-80"
            >
              撥打電話
            </a>
          )}
          {(m.website ?? '').trim() && (
            <a
              href={/^https?:\/\//i.test(m.website!.trim()) ? m.website!.trim() : `https://${m.website!.trim()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-bold text-center active:opacity-80"
            >
              看官網
            </a>
          )}
          {(m.email ?? '').trim() && (
            <a
              href={`mailto:${m.email!.trim()}`}
              className="block w-full py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-bold text-center active:opacity-80"
            >
              寫信給我
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
