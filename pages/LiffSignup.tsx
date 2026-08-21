import React, { useEffect, useState } from 'react';
import liff from '@line/liff';
import { createClient } from '@supabase/supabase-js';
import { Check, Users, Clock, MapPin, X, Loader2, AlertCircle, Wallet } from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

// 接龍報名專用 LIFF app
const LIFF_SIGNUP_ID = import.meta.env.VITE_LIFF_SIGNUP_ID as string;

// OAuth 導轉可能把 ?sheet= 弄丟，先暫存一份
const TOKEN_STORAGE_KEY = 'changzhan_signup_token';

type Entry = {
  id: number;
  real_name: string;
  extra_count: number;
  extra_names: string | null;
  note: string | null;
  is_member: boolean;
  is_me: boolean;
  created_at: string;
};

type Sheet = {
  title: string;
  description: string | null;
  deadline: string | null;
  max_people: number | null;
  fee: number;
  member_fee: number | null;
  allow_guests: boolean;
  allow_non_members: boolean;
  status: string;
  closed: boolean;
};

type SheetData = {
  ok: boolean;
  error?: string;
  sheet: Sheet;
  activity: { id: number; title: string; date: string; time: string; location: string } | null;
  head_count: number;
  entries: Entry[];
};

type Phase =
  | { kind: 'loading'; msg: string }
  | { kind: 'ready' }
  | { kind: 'error'; msg: string };

function withTimeout<T>(promise: Promise<T>, ms: number, errMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errMsg)), ms)),
  ]);
}

/** 從 URL 取 sheet token（OAuth 重導回來時參數會包在 liff.state 裡） */
function parseToken(): string {
  const direct = new URLSearchParams(window.location.search).get('sheet');
  if (direct) return direct;
  const state = new URLSearchParams(window.location.search).get('liff.state');
  if (state) {
    const decoded = decodeURIComponent(state);
    const qs = decoded.includes('?') ? decoded.slice(decoded.indexOf('?')) : decoded;
    const t = new URLSearchParams(qs).get('sheet');
    if (t) return t;
  }
  return '';
}

const fmtDeadline = (iso: string) =>
  new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const LiffSignup: React.FC = () => {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading', msg: '載入中…' });
  // ⚠️ token 不能在第一次 render 就判定：外部瀏覽器走 OAuth 回來時網址只有 code/state，
  // 原本的 ?sheet= 要等 liff.init() 跑完才會被還原。
  const [token, setToken] = useState('');
  const [data, setData] = useState<SheetData | null>(null);
  const [lineUserId, setLineUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isMember, setIsMember] = useState(false);

  // 表單
  const [realName, setRealName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [referrer, setReferrer] = useState('');
  const [extraCount, setExtraCount] = useState(0);
  const [extraNames, setExtraNames] = useState('');
  const [note, setNote] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [memberNames, setMemberNames] = useState<string[]>([]);

  const myEntry = data?.entries.find(e => e.is_me) ?? null;

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    if (!LIFF_SIGNUP_ID) {
      setPhase({ kind: 'error', msg: '系統尚未設定 LIFF ID，請聯絡幹部。' });
      return;
    }
    // 進 OAuth 前先把 token 存起來，萬一導回來時網址沒還原也救得回來
    const beforeLogin = parseToken();
    if (beforeLogin) sessionStorage.setItem(TOKEN_STORAGE_KEY, beforeLogin);

    try {
      setPhase({ kind: 'loading', msg: '連線 LINE…' });
      await withTimeout(liff.init({ liffId: LIFF_SIGNUP_ID }), 8000, 'LINE 初始化逾時');
      if (!liff.isLoggedIn()) {
        // 帶上目前網址，登入完才回得到同一張接龍
        liff.login({ redirectUri: window.location.href });
        return;
      }

      // init 之後 LIFF 才會把原本的 query 還原回來
      const t = parseToken() || sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
      if (!t) {
        setPhase({ kind: 'error', msg: '缺少接龍代碼，請從主辦人分享的連結進入。' });
        return;
      }
      sessionStorage.setItem(TOKEN_STORAGE_KEY, t);
      setToken(t);

      const profile = await withTimeout(liff.getProfile(), 5000, '取得 LINE 資料逾時');
      setLineUserId(profile.userId);
      setDisplayName(profile.displayName);

      // 帶入先前填過的資料（會員直接用會員資料）
      const { data: pre } = await supabase.rpc('public_signup_prefill', {
        p_line_user_id: profile.userId,
      });
      if (pre) {
        setIsMember(!!pre.is_member);
        setRealName(pre.real_name ?? profile.displayName ?? '');
        setPhone(pre.phone ?? '');
        setCompany(pre.company ?? '');
        setReferrer(pre.referrer ?? '');
      }

      await loadSheet(profile.userId, t);
      setPhase({ kind: 'ready' });
    } catch (e: any) {
      setPhase({ kind: 'error', msg: e?.message ?? String(e) });
    }
  }

  async function loadSheet(uid: string, tk?: string) {
    const { data: res, error } = await supabase.rpc('public_signup_sheet', {
      p_token: tk ?? token,
      p_viewer_line_user_id: uid,
    });
    if (error) throw new Error('讀取接龍失敗：' + error.message);
    if (!res?.ok) {
      throw new Error(res?.error === 'not_found' ? '找不到這個接龍，連結可能已失效。' : '讀取失敗');
    }
    setData(res as SheetData);
    const mine = (res as SheetData).entries.find(e => e.is_me);
    if (mine) {
      setExtraCount(mine.extra_count);
      setExtraNames(mine.extra_names ?? '');
      setNote(mine.note ?? '');
      setRealName(mine.real_name);
    }
  }

  // 引薦人下拉：非會員才需要，選會員名字而不是自由打字
  async function ensureMemberNames() {
    if (memberNames.length > 0) return;
    const { data: dir } = await supabase.rpc('public_member_directory');
    if (dir) setMemberNames((dir as any[]).map(m => m.name).filter(Boolean));
  }

  async function submit() {
    if (!realName.trim()) {
      alert('請填姓名');
      return;
    }
    if (!isMember && !phone.trim()) {
      alert('請填電話，方便主辦人聯絡');
      return;
    }
    setSubmitting(true);
    try {
      const { data: res, error } = await supabase.rpc('public_signup_join', {
        p_token: token,
        p_line_user_id: lineUserId,
        p_display_name: displayName,
        p_real_name: realName.trim(),
        p_phone: phone.trim() || null,
        p_company: company.trim() || null,
        p_referrer: referrer.trim() || null,
        p_extra_count: extraCount,
        p_extra_names: extraNames.trim() || null,
        p_note: note.trim() || null,
      });
      if (error) {
        alert('報名失敗：' + error.message);
        return;
      }
      if (!res?.ok) {
        const msgs: Record<string, string> = {
          closed: '這個接龍已經結束了',
          deadline_passed: '已經過了報名截止時間',
          members_only: '這個接龍限會員參加',
          phone_required: '請填電話',
          name_required: '請填姓名',
          not_found: '找不到這個接龍',
          full: `名額不足，目前只剩 ${res?.remaining ?? 0} 個位子`,
        };
        alert(msgs[res?.error] ?? '報名失敗');
        return;
      }
      setFormOpen(false);
      await loadSheet(lineUserId);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel() {
    if (!window.confirm('確定要取消報名嗎？')) return;
    setSubmitting(true);
    try {
      const { data: res } = await supabase.rpc('public_signup_cancel', {
        p_token: token,
        p_line_user_id: lineUserId,
      });
      if (!res?.ok) {
        alert(res?.error === 'closed' ? '這個接龍已經結束了' : '取消失敗');
        return;
      }
      setExtraCount(0);
      setExtraNames('');
      setNote('');
      await loadSheet(lineUserId);
    } finally {
      setSubmitting(false);
    }
  }

  if (phase.kind === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 p-6">
        <Loader2 className="animate-spin text-red-600" size={36} />
        <p className="text-gray-400 text-sm font-medium">{phase.msg}</p>
      </div>
    );
  }

  if (phase.kind === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle className="text-red-500" size={40} />
        <p className="text-gray-700 font-bold">{phase.msg}</p>
      </div>
    );
  }

  const sheet = data!.sheet;
  const entries = data!.entries;
  // 分級時本人依身分計價，同行者一律一般價
  const myUnitFee = sheet.member_fee != null && isMember ? sheet.member_fee : sheet.fee;
  const myTotalFee = myUnitFee + sheet.fee * extraCount;
  const full =
    sheet.max_people !== null && data!.head_count >= sheet.max_people && !myEntry;
  const canSignUp = !sheet.closed && !full && (isMember || sheet.allow_non_members);

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* 標題區 */}
      <div className="bg-white px-5 pt-8 pb-6 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 leading-snug">{sheet.title}</h1>
        {sheet.description && (
          <p className="text-gray-500 text-sm mt-2 whitespace-pre-wrap">{sheet.description}</p>
        )}
        {data!.activity && (
          <div className="mt-3 text-xs text-gray-500 space-y-1">
            <p className="flex items-center gap-1.5">
              <Clock size={13} /> {data!.activity.date} {data!.activity.time}
            </p>
            {data!.activity.location && (
              <p className="flex items-center gap-1.5">
                <MapPin size={13} /> {data!.activity.location}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-sm font-bold">
            <Users size={15} /> 目前 {data!.head_count} 人
            {sheet.max_people !== null && ` / ${sheet.max_people}`}
          </span>
          {(sheet.fee > 0 || (sheet.member_fee ?? 0) > 0) && (
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-sm font-bold">
              <Wallet size={15} />
              {sheet.member_fee != null ? (
                <>
                  {isMember ? '會員價' : '一般價'} NT$ {myUnitFee.toLocaleString('zh-TW')}
                </>
              ) : (
                <>每人 NT$ {sheet.fee.toLocaleString('zh-TW')}</>
              )}
            </span>
          )}
          {sheet.deadline && (
            <span className="text-xs text-gray-400 font-medium">
              截止 {fmtDeadline(sheet.deadline)}
            </span>
          )}
        </div>
        {sheet.member_fee != null && (
          <p className="text-[11px] text-gray-400 mt-2">
            會員 NT$ {sheet.member_fee.toLocaleString('zh-TW')} · 一般 NT$ {sheet.fee.toLocaleString('zh-TW')}
            （帶的人算一般價）
          </p>
        )}
        {sheet.closed && (
          <div className="mt-3 bg-gray-100 text-gray-500 text-sm font-bold px-3 py-2 rounded-lg text-center">
            報名已結束
          </div>
        )}
        {!sheet.closed && full && (
          <div className="mt-3 bg-amber-50 text-amber-700 text-sm font-bold px-3 py-2 rounded-lg text-center">
            名額已滿
          </div>
        )}
        {!sheet.closed && !isMember && !sheet.allow_non_members && (
          <div className="mt-3 bg-amber-50 text-amber-700 text-sm font-bold px-3 py-2 rounded-lg text-center">
            這個接龍限會員參加
          </div>
        )}
      </div>

      {/* 名單 */}
      <div className="px-5 py-6">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">
          報名名單
        </h2>
        {entries.length === 0 ? (
          <p className="text-gray-300 text-sm text-center py-10">還沒有人報名，你可以是第一個</p>
        ) : (
          <ol className="space-y-2">
            {entries.map((e, i) => (
              <li
                key={e.id}
                className={`flex items-start gap-3 bg-white rounded-xl px-4 py-3 border ${
                  e.is_me ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100'
                }`}
              >
                <span className="text-sm font-bold text-gray-300 w-6 shrink-0 pt-0.5">{i + 1}</span>
                <div className="min-w-0 flex-grow">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900">{e.real_name}</span>
                    {e.extra_count > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                        +{e.extra_count}
                      </span>
                    )}
                    {!e.is_member && (
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">
                        來賓
                      </span>
                    )}
                    {e.is_me && (
                      <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-bold">
                        我
                      </span>
                    )}
                  </div>
                  {(e.extra_names || e.note) && (
                    <p className="text-xs text-gray-400 mt-1">
                      {e.extra_names}
                      {e.extra_names && e.note ? ' · ' : ''}
                      {e.note}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* 底部操作列 */}
      {!sheet.closed && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4 shadow-2xl">
          {myEntry ? (
            <div className="flex gap-2">
              <button
                onClick={cancel}
                disabled={submitting}
                className="flex-1 border border-gray-200 text-gray-500 py-3.5 rounded-2xl font-bold disabled:opacity-50"
              >
                取消報名
              </button>
              <button
                onClick={() => setFormOpen(true)}
                disabled={submitting}
                className="flex-1 bg-gray-900 text-white py-3.5 rounded-2xl font-bold disabled:opacity-50"
              >
                修改
              </button>
            </div>
          ) : (
            <button
              onClick={async () => {
                if (!isMember) await ensureMemberNames();
                setFormOpen(true);
              }}
              disabled={!canSignUp || submitting}
              className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-red-200 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:shadow-none"
            >
              ＋1 我要參加
            </button>
          )}
        </div>
      )}

      {/* 報名表單 */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">{myEntry ? '修改報名' : '我要參加'}</h3>
              <button onClick={() => setFormOpen(false)} className="text-gray-300 hover:text-gray-500">
                <X size={22} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">姓名 *</label>
                <input
                  value={realName}
                  onChange={e => setRealName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="真實姓名"
                />
              </div>

              {/* 會員的聯絡資料系統已經有了，不用再問一次 */}
              {!isMember && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">電話 *</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="09xx-xxx-xxx"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">
                      公司 <span className="text-gray-300 font-medium">選填</span>
                    </label>
                    <input
                      value={company}
                      onChange={e => setCompany(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">
                      引薦人 <span className="text-gray-300 font-medium">選填</span>
                    </label>
                    <input
                      list="member-names"
                      value={referrer}
                      onChange={e => setReferrer(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="邀請你來的會員"
                    />
                    <datalist id="member-names">
                      {memberNames.map(n => (
                        <option key={n} value={n} />
                      ))}
                    </datalist>
                  </div>
                </>
              )}

              {sheet.allow_guests && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">再帶幾位</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setExtraCount(Math.max(0, extraCount - 1))}
                        className="w-11 h-11 rounded-xl border border-gray-200 text-xl font-bold text-gray-500 active:bg-gray-50"
                      >
                        －
                      </button>
                      <span className="text-xl font-bold w-10 text-center">{extraCount}</span>
                      <button
                        onClick={() => setExtraCount(Math.min(20, extraCount + 1))}
                        className="w-11 h-11 rounded-xl border border-gray-200 text-xl font-bold text-gray-500 active:bg-gray-50"
                      >
                        ＋
                      </button>
                      <span className="text-xs text-gray-400">含眷屬、朋友</span>
                    </div>
                    {myTotalFee > 0 && (
                      <p className="text-xs text-amber-700 mt-2 font-bold">
                        共 {1 + extraCount} 位 · 應付 NT$ {myTotalFee.toLocaleString('zh-TW')}
                        {sheet.member_fee != null && extraCount > 0 && (
                          <span className="font-medium text-gray-400">
                            （本人 {myUnitFee} + 同行 {extraCount} × {sheet.fee}）
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  {extraCount > 0 && (
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">
                        同行者姓名 <span className="text-gray-300 font-medium">選填</span>
                      </label>
                      <input
                        value={extraNames}
                        onChange={e => setExtraNames(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="例：太太、王小明"
                      />
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  備註 <span className="text-gray-300 font-medium">選填</span>
                </label>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="例：素食、晚點到"
                />
              </div>

              <button
                onClick={submit}
                disabled={submitting}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-red-200 active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                {myEntry ? '儲存修改' : '確認報名'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiffSignup;
