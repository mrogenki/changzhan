import React, { useEffect, useState } from 'react';
import liff from '@line/liff';
import { Loader2, AlertCircle, Plus, Share2, Pencil, X, Copy, Check, CalendarDays, MapPin, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { CHAPTER_NAME, LIFF_SIGNUP_ID } from '../chapterConfig';

// 小組長自助發起組聚（/liff/signup?host=1，共用接龍的 LIFF app）
//
// 身分靠 LIFF 的 ID token，送到 leader-activity edge function 由伺服器向 LINE 驗證。
// 不能像接龍頁一樣只傳 LINE user ID：建立公開活動的風險比報名 +1 高得多，
// 知道別人的 LINE ID 就能冒名發活動。
//
// ⚠️ LIFF app 必須勾選 openid scope，liff.getIDToken() 才拿得到東西。

// is_group_leader 由 leader-activity 依 members.positions 是否含「小組長」算好，
// 前端不自己比對職務字串（權限判斷留在伺服器端）
type Profile = { id: number; name: string; group_name: string | null; positions: string[]; is_group_leader: boolean };

type MyActivity = {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string | null;
  price: number | null;
  member_price: number | null;
  status: string;
  signup_token: string | null;
  max_people: number | null;
  head_count: number;
};

type Form = {
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  price: string;
  member_price: string;
  max_people: string;
};

const EMPTY_FORM: Form = {
  title: '', date: '', time: '19:00', location: '', description: '',
  price: '', member_price: '', max_people: '',
};

type Phase =
  | { kind: 'loading'; msg: string }
  | { kind: 'error'; msg: string }
  | { kind: 'ready' };

type View =
  | { kind: 'list' }
  | { kind: 'form'; editing: MyActivity | null }
  | { kind: 'done'; activity: MyActivity };

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

// activities.date 是純日期字串，new Date('2026-10-06') 會被當 UTC 而差一天，
// 所以自己拆字串、用本地時間建構來算星期。
function fmtDate(date: string, time?: string | null) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!m) return `${date}${time ? ` ${time}` : ''}`;
  const [, y, mo, d] = m;
  const wd = WEEKDAYS[new Date(+y, +mo - 1, +d).getDay()];
  return `${+mo}/${+d}（${wd}）${time ? ` ${time}` : ''}`;
}

/** 組名是數字才加「第 N 組」，像「三尊」這種就原樣用（與 leader-activity 一致） */
const fmtGroup = (g: string | null) => (!g ? '（未設定組別）' : /^\d+$/.test(g) ? `第 ${g} 組` : g);

const todayTpe = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());

const signupUrl = (token: string) =>
  `https://liff.line.me/${LIFF_SIGNUP_ID}?sheet=${encodeURIComponent(token)}`;

const nt = (n: number) => `NT$ ${n.toLocaleString('zh-TW')}`;

function feeLine(a: Pick<MyActivity, 'price' | 'member_price'>) {
  const p = a.price ?? 0;
  if (a.member_price != null) return `會員 ${nt(a.member_price)}／一般 ${nt(p)}`;
  return p > 0 ? `每人 ${nt(p)}` : '免費';
}

function shareText(a: MyActivity) {
  const lines = [
    `📣 ${a.title}`,
    `📅 ${fmtDate(a.date, a.time)}`,
    `📍 ${a.location}`,
    `💰 ${feeLine(a)}`,
  ];
  if (a.description) lines.push('', a.description);
  if (a.signup_token) lines.push('', `👉 點這裡報名：${signupUrl(a.signup_token)}`);
  return lines.join('\n');
}

/** functions.invoke 在 non-2xx 時只給 FunctionsHttpError，真正的訊息藏在 error.context 裡 */
async function callLeader(payload: Record<string, unknown>) {
  const idToken = liff.getIDToken();
  if (!idToken) throw new Error('拿不到 LINE 身分憑證，請關閉後重新開啟');
  const { data, error } = await supabase.functions.invoke('leader-activity', {
    body: { ...payload, idToken },
  });
  if (error) {
    let msg = error.message;
    try {
      const body = await (error as any).context?.json?.();
      msg = body?.message || body?.error || msg;
    } catch { /* 保留原訊息 */ }
    throw new Error(msg);
  }
  return data;
}

const LiffHost: React.FC = () => {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading', msg: '連線 LINE…' });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activities, setActivities] = useState<MyActivity[]>([]);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    if (!LIFF_SIGNUP_ID) {
      setPhase({ kind: 'error', msg: '系統尚未設定 LIFF ID，請聯絡幹部。' });
      return;
    }
    try {
      await liff.init({ liffId: LIFF_SIGNUP_ID });
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }
      // iOS LINE 內建瀏覽器的 isApiAvailable 偶爾誤報 false，在 LINE 裡就讓它試
      setCanShare(liff.isInClient() || liff.isApiAvailable('shareTargetPicker'));
      if (!liff.getIDToken()) {
        setPhase({
          kind: 'error',
          msg: '這個 LIFF app 沒有開啟 openid 權限，無法確認身分。請幹部到 LINE Developers 勾選 openid scope。',
        });
        return;
      }
      await reload();
      setPhase({ kind: 'ready' });
    } catch (e: any) {
      setPhase({ kind: 'error', msg: e?.message ?? String(e) });
    }
  }

  async function reload() {
    const res = await callLeader({ action: 'me' });
    setProfile(res?.member ?? null);
    setActivities(res?.activities ?? []);
  }

  function openForm(editing: MyActivity | null) {
    setForm(editing ? {
      title: editing.title,
      date: editing.date,
      time: editing.time,
      location: editing.location,
      description: editing.description ?? '',
      price: String(editing.price ?? ''),
      member_price: editing.member_price != null ? String(editing.member_price) : '',
      max_people: editing.max_people != null ? String(editing.max_people) : '',
    } : { ...EMPTY_FORM });
    setView({ kind: 'form', editing });
  }

  async function submit() {
    if (!form.date) return alert('請選擇日期');
    if (!form.time) return alert('請選擇時間');
    if (!form.location.trim()) return alert('請填地點');
    setSaving(true);
    try {
      const activity = {
        title: form.title.trim(),
        date: form.date,
        time: form.time,
        location: form.location.trim(),
        description: form.description.trim(),
        price: form.price === '' ? 0 : Number(form.price),
        member_price: form.member_price === '' ? null : Number(form.member_price),
        max_people: form.max_people === '' ? null : Number(form.max_people),
      };
      const editing = view.kind === 'form' ? view.editing : null;
      if (editing) {
        await callLeader({ action: 'update', activityId: editing.id, activity });
        await reload();
        setView({ kind: 'list' });
      } else {
        const res = await callLeader({ action: 'create', activity });
        // 從重新載入的清單裡拿剛建好的那筆（含接龍 token），直接進分享畫面
        const fresh = await callLeader({ action: 'me' });
        setActivities(fresh?.activities ?? []);
        const created = (fresh?.activities ?? []).find((a: MyActivity) => a.id === res.activity_id);
        setView(created ? { kind: 'done', activity: created } : { kind: 'list' });
      }
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function cancel(a: MyActivity) {
    if (!confirm(`確定取消「${a.title}」？\n\n官網會下架這場組聚，接龍也會關閉。已報名的名單會保留給幹部查詢。`)) return;
    try {
      await callLeader({ action: 'cancel', activityId: a.id });
      await reload();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  async function share(a: MyActivity) {
    try {
      const res = await liff.shareTargetPicker([{ type: 'text', text: shareText(a) }]);
      // 使用者按取消時 res 是 undefined，不用提示
      if (res) alert('已分享');
    } catch (e: any) {
      alert('無法開啟分享：' + (e?.message ?? String(e)) + '\n\n可以改用「複製訊息」再貼到群組。');
    }
  }

  async function copy(a: MyActivity) {
    try {
      await navigator.clipboard.writeText(shareText(a));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt('請長按複製：', shareText(a));
    }
  }

  // ===== 畫面 =====

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
        <p className="text-gray-700 font-bold leading-relaxed">{phase.msg}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertCircle className="text-gray-400" size={40} />
        <p className="text-gray-700 font-bold">找不到你的會員資料</p>
        <p className="text-gray-400 text-sm leading-relaxed">
          這個 LINE 帳號還沒有綁定{CHAPTER_NAME}的會員。<br />請先完成會員綁定，或聯絡幹部。
        </p>
      </div>
    );
  }

  if (!profile.is_group_leader) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <Users className="text-gray-400" size={40} />
        <p className="text-gray-700 font-bold">{profile.name} 你好</p>
        <p className="text-gray-400 text-sm leading-relaxed">
          發起組聚目前只開放給小組長。<br />如果你是小組長，請聯絡幹部幫你開通。
        </p>
      </div>
    );
  }

  const groupLabel = fmtGroup(profile.group_name);

  // --- 建立成功 → 分享 ---
  if (view.kind === 'done') {
    const a = view.activity;
    return (
      <div className="min-h-screen bg-gray-50 p-5 pb-10">
        <div className="max-w-md mx-auto">
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check size={28} />
            </div>
            <h1 className="text-xl font-bold">組聚已發起</h1>
            <p className="text-gray-400 text-sm mt-1">官網與行事曆已經看得到了，接龍也開好了</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-sm whitespace-pre-wrap leading-relaxed text-gray-700">
            {shareText(a)}
          </div>

          <div className="mt-5 space-y-3">
            {canShare && (
              <button onClick={() => share(a)}
                className="w-full bg-[#06C755] text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                <Share2 size={20} /> 分享到 LINE 群組
              </button>
            )}
            <button onClick={() => copy(a)}
              className="w-full bg-white border border-gray-200 text-gray-700 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2">
              {copied ? <><Check size={18} /> 已複製</> : <><Copy size={18} /> 複製訊息</>}
            </button>
            <button onClick={() => setView({ kind: 'list' })}
              className="w-full text-gray-400 py-3 text-sm font-bold">
              回到我的組聚
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- 表單 ---
  if (view.kind === 'form') {
    const editing = view.editing;
    const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));
    const input = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-red-500';
    const label = 'block text-sm font-bold text-gray-500 mb-1.5';
    return (
      <div className="min-h-screen bg-gray-50 pb-32">
        <div className="bg-white border-b px-5 py-4 flex items-center justify-between sticky top-0 z-10">
          <h1 className="font-bold text-lg">{editing ? '修改組聚' : '發起組聚'}</h1>
          <button onClick={() => setView({ kind: 'list' })} className="text-gray-400 p-1"><X size={22} /></button>
        </div>

        <div className="max-w-md mx-auto p-5 space-y-5">
          <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm font-bold">
            {groupLabel} · 活動類型固定為「組聚」
          </div>

          <div>
            <label className={label}>主題</label>
            <input className={input} value={form.title} onChange={set('title')}
              placeholder={`${groupLabel}組聚`} maxLength={60} />
            <p className="text-xs text-gray-400 mt-1">留白就用「{groupLabel}組聚」</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>日期 *</label>
              <input type="date" className={input} value={form.date} onChange={set('date')} min={todayTpe()} />
            </div>
            <div>
              <label className={label}>時間 *</label>
              <input type="time" className={input} value={form.time} onChange={set('time')} />
            </div>
          </div>

          <div>
            <label className={label}>地點 *</label>
            <input className={input} value={form.location} onChange={set('location')} placeholder="餐廳名稱與地址" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>費用</label>
              <input type="number" inputMode="numeric" min={0} className={input}
                value={form.price} onChange={set('price')} placeholder="0 = 免費" />
            </div>
            <div>
              <label className={label}>會員價</label>
              <input type="number" inputMode="numeric" min={0} className={input}
                value={form.member_price} onChange={set('member_price')} placeholder="不分級可留白" />
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-3">有填會員價時，「費用」就是來賓的一般價；同行者一律算一般價。</p>

          <div>
            <label className={label}>人數上限</label>
            <input type="number" inputMode="numeric" min={1} className={input}
              value={form.max_people} onChange={set('max_people')} placeholder="不限可留白" />
          </div>

          <div>
            <label className={label}>說明</label>
            <textarea className={`${input} min-h-[100px]`} value={form.description} onChange={set('description')}
              placeholder="餐點、注意事項…" />
          </div>
        </div>

        <div className="fixed bottom-0 inset-x-0 bg-white border-t p-4">
          <div className="max-w-md mx-auto">
            <button onClick={submit} disabled={saving}
              className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-red-200 active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="animate-spin" size={20} />}
              {editing ? '儲存修改' : '發起並開接龍'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- 我的組聚 ---
  // 日期一律用 YYYY-MM-DD 字串比對，不進 Date 物件（避免被當 UTC 而差一天）
  const today = todayTpe();
  const upcoming = activities.filter(a => a.status === 'active' && a.date >= today);
  const past = activities.filter(a => !(a.status === 'active' && a.date >= today));
  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-white border-b px-5 py-5">
        <p className="text-xs text-gray-400 font-bold">{CHAPTER_NAME} · {groupLabel}</p>
        <h1 className="text-xl font-bold mt-0.5">{profile.name} 的組聚</h1>
      </div>

      <div className="max-w-md mx-auto p-5 space-y-3">
        {upcoming.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">
            還沒有發起過組聚<br />按下方按鈕開始
          </div>
        )}
        {upcoming.map(a => (
          <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="font-bold text-gray-900">{a.title}</p>
            <div className="mt-2 space-y-1 text-sm text-gray-500">
              <p className="flex items-center gap-1.5"><CalendarDays size={14} />{fmtDate(a.date, a.time)}</p>
              <p className="flex items-center gap-1.5"><MapPin size={14} />{a.location}</p>
              <p className="flex items-center gap-1.5">
                <Users size={14} />已報名 {a.head_count} 人{a.max_people ? ` / ${a.max_people}` : ''}
                <span className="text-gray-300">·</span>{feeLine(a)}
              </p>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => (canShare ? share(a) : copy(a))}
                className="flex-1 bg-[#06C755] text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5">
                <Share2 size={15} /> {canShare ? '分享' : '複製訊息'}
              </button>
              <button onClick={() => openForm(a)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5">
                <Pencil size={15} /> 修改
              </button>
              <button onClick={() => cancel(a)}
                className="border border-gray-200 text-gray-400 px-3 py-2.5 rounded-xl text-sm font-bold">
                取消
              </button>
            </div>
          </div>
        ))}

        {past.length > 0 && (
          <div className="pt-4">
            <p className="text-xs text-gray-400 font-bold mb-2">已結束／已取消</p>
            {past.map(a => (
              <div key={a.id} className={`text-sm text-gray-400 py-1.5 ${a.status !== 'active' ? 'line-through' : ''}`}>
                {fmtDate(a.date, a.time)} {a.title}
                {a.status === 'active' && <span className="ml-1.5 text-xs">（{a.head_count} 人）</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t p-4">
        <div className="max-w-md mx-auto">
          <button onClick={() => openForm(null)}
            className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-red-200 active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
            <Plus size={22} /> 發起組聚
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiffHost;
