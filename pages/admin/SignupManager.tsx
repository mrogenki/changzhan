import React, { useEffect, useMemo, useState } from 'react';
import {
  ListOrdered,
  Plus,
  Link2,
  Trash2,
  Users,
  Wallet,
  X,
  ArrowLeft,
  UserPlus,
  Check,
  Pencil,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Activity, AdminUser, Member } from '../../types';

interface Props {
  canEdit: boolean;
  activities: Activity[];
  members: Member[];
  currentUser: AdminUser;
}

type Sheet = {
  id: number;
  token: string;
  title: string;
  description: string | null;
  activity_id: number | null;
  deadline: string | null;
  max_people: number | null;
  fee: number;
  allow_guests: boolean;
  allow_non_members: boolean;
  status: 'open' | 'closed';
  created_by: string | null;
  created_at: string;
};

type Entry = {
  id: number;
  sheet_id: number;
  line_user_id: string | null;
  member_id: number | null;
  display_name: string | null;
  real_name: string;
  phone: string | null;
  company: string | null;
  referrer: string | null;
  extra_count: number;
  extra_names: string | null;
  note: string | null;
  created_at: string;
};

const SIGNUP_LIFF_ID = import.meta.env.VITE_LIFF_SIGNUP_ID as string | undefined;

const sheetUrl = (token: string) =>
  SIGNUP_LIFF_ID
    ? `https://liff.line.me/${SIGNUP_LIFF_ID}?sheet=${encodeURIComponent(token)}`
    : `${window.location.origin}/liff/signup?sheet=${encodeURIComponent(token)}`;

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'short', timeStyle: 'short' }) : '';

const SignupManager: React.FC<Props> = ({ canEdit, activities, members, currentUser }) => {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSheet, setOpenSheet] = useState<Sheet | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSheet, setEditingSheet] = useState<Sheet | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [s, e] = await Promise.all([
        supabase.from('signup_sheets').select('*').order('created_at', { ascending: false }),
        supabase.from('signup_entries').select('*').order('created_at'),
      ]);
      setSheets((s.data ?? []) as Sheet[]);
      setEntries((e.data ?? []) as Entry[]);
    } finally {
      setLoading(false);
    }
  }

  const headCount = (sheetId: number) =>
    entries.filter(e => e.sheet_id === sheetId).reduce((sum, e) => sum + 1 + e.extra_count, 0);

  async function copyLink(sheet: Sheet) {
    const url = sheetUrl(sheet.token);
    try {
      await navigator.clipboard.writeText(url);
      alert('連結已複製，可以貼到 LINE 群組了：\n\n' + url);
    } catch {
      window.prompt('複製這個連結貼到 LINE 群組：', url);
    }
  }

  async function toggleStatus(sheet: Sheet) {
    const next = sheet.status === 'open' ? 'closed' : 'open';
    const { error } = await supabase.from('signup_sheets').update({ status: next }).eq('id', sheet.id);
    if (error) alert('更新失敗：' + error.message);
    else load();
  }

  async function removeSheet(sheet: Sheet) {
    const n = entries.filter(e => e.sheet_id === sheet.id).length;
    if (!window.confirm(`確定要刪除「${sheet.title}」嗎？\n\n底下 ${n} 筆報名會一併刪除，無法復原。`)) return;
    const { error } = await supabase.from('signup_sheets').delete().eq('id', sheet.id);
    if (error) alert('刪除失敗：' + error.message);
    else {
      setOpenSheet(null);
      load();
    }
  }

  if (loading) return <div className="p-10 text-center text-gray-400">載入接龍資料中...</div>;

  if (openSheet) {
    const current = sheets.find(s => s.id === openSheet.id) ?? openSheet;
    return (
      <SheetDetail
        canEdit={canEdit}
        sheet={current}
        entries={entries.filter(e => e.sheet_id === current.id)}
        activities={activities}
        members={members}
        currentUser={currentUser}
        onBack={() => setOpenSheet(null)}
        onChanged={load}
        onEdit={() => setEditingSheet(current)}
        onCopyLink={() => copyLink(current)}
        onToggleStatus={() => toggleStatus(current)}
        onDelete={() => removeSheet(current)}
      />
    );
  }

  return (
    <div className="space-y-6 text-gray-900">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListOrdered size={24} className="text-red-600" /> 接龍報名
          </h1>
          <p className="text-gray-500 text-sm">建立接龍後把連結貼到 LINE 群組，成員點開一鍵報名。</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl hover:bg-red-700 shadow-sm"
          >
            <Plus size={18} /> 建立接龍
          </button>
        )}
      </div>

      {!SIGNUP_LIFF_ID && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-4">
          尚未設定 <code className="font-mono">VITE_LIFF_SIGNUP_ID</code>，複製出來的連結會是網頁版而不是 LIFF，
          在 LINE 裡打不開。請在 Vercel 環境變數補上後重新部署。
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">接龍</th>
                <th className="px-6 py-4">人數</th>
                <th className="px-6 py-4">截止</th>
                <th className="px-6 py-4">狀態</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sheets.map(s => {
                const activity = activities.find(a => String(a.id) === String(s.activity_id));
                return (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setOpenSheet(s)}
                        className="font-bold text-gray-900 hover:text-red-600 text-left"
                      >
                        {s.title}
                      </button>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {activity ? `活動：${activity.title}` : '自由主題'}
                        {s.fee > 0 && ` · 每人 NT$ ${s.fee.toLocaleString('zh-TW')}`}
                        {s.max_people !== null && ` · 上限 ${s.max_people} 人`}
                        {!s.allow_non_members && ' · 限會員'}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-700 whitespace-nowrap">
                      {headCount(s.id)}
                      {s.max_people !== null && <span className="text-gray-300"> / {s.max_people}</span>}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                      {s.deadline ? fmt(s.deadline) : '不限'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => canEdit && toggleStatus(s)}
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          s.status === 'open' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {s.status === 'open' ? '進行中' : '已結束'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => copyLink(s)}
                        className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg"
                        title="複製連結"
                      >
                        <Link2 size={16} />
                      </button>
                      <button
                        onClick={() => setOpenSheet(s)}
                        className="text-xs font-bold text-red-600 hover:underline px-2"
                      >
                        名單
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => setEditingSheet(s)}
                          className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg"
                          title="編輯接龍"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => removeSheet(s)}
                          className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg align-middle"
                          title="刪除"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sheets.length === 0 && (
            <div className="p-10 text-center text-gray-400">
              還沒有接龍。點右上角「建立接龍」開始。
            </div>
          )}
        </div>
      </div>

      {(createOpen || editingSheet) && (
        <SheetFormModal
          sheet={editingSheet}
          activities={activities}
          currentUser={currentUser}
          onClose={() => {
            setCreateOpen(false);
            setEditingSheet(null);
          }}
          onSaved={async () => {
            setCreateOpen(false);
            setEditingSheet(null);
            await load();
          }}
        />
      )}
    </div>
  );
};

/* ---------------- 名單詳情 ---------------- */

const SheetDetail: React.FC<{
  canEdit: boolean;
  sheet: Sheet;
  entries: Entry[];
  activities: Activity[];
  members: Member[];
  currentUser: AdminUser;
  onBack: () => void;
  onChanged: () => void;
  onEdit: () => void;
  onCopyLink: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}> = ({ canEdit, sheet, entries, activities, members, currentUser, onBack, onChanged, onEdit, onCopyLink, onToggleStatus, onDelete }) => {
  const [addOpen, setAddOpen] = useState(false);
  const [converting, setConverting] = useState(false);

  const head = entries.reduce((s, e) => s + 1 + e.extra_count, 0);
  const activity = activities.find(a => String(a.id) === String(sheet.activity_id));

  async function removeEntry(e: Entry) {
    if (!window.confirm(`確定要移除「${e.real_name}」的報名嗎？`)) return;
    const { error } = await supabase.from('signup_entries').delete().eq('id', e.id);
    if (error) alert('移除失敗：' + error.message);
    else onChanged();
  }

  // 轉成收款項目：本人一筆，帶的每一位也各一筆（人頭數與收款筆數對得起來）
  async function convertToPayment() {
    const amountStr = window.prompt(`要向這 ${head} 位收多少錢？（每人金額）`, String(sheet.fee || 0));
    if (amountStr === null) return;
    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount < 0) {
      alert('金額不正確');
      return;
    }
    if (!window.confirm(`建立收款項目「${sheet.title}」\n\n對象：${head} 位\n每人：NT$ ${amount.toLocaleString('zh-TW')}\n\n確定嗎？`))
      return;

    setConverting(true);
    try {
      const { data: batch, error } = await supabase
        .from('payment_batches')
        .insert([
          {
            title: sheet.title,
            default_amount: amount,
            activity_id: sheet.activity_id,
            finance_category: sheet.activity_id ? '活動費用' : '其他',
            status: 'open',
            note: '由接龍名單建立',
            created_by: currentUser.name,
          },
        ])
        .select()
        .single();
      if (error || !batch) {
        alert('建立收款項目失敗：' + (error?.message ?? ''));
        return;
      }

      const rows: any[] = [];
      entries.forEach(e => {
        rows.push({
          batch_id: batch.id,
          payee_name: e.real_name,
          payee_phone: e.phone,
          member_id: e.member_id,
          amount_due: amount,
          amount_paid: 0,
        });
        // 同行者：有填名字就用名字拆開，沒填就標成「○○○ 的同行者 N」
        const names = (e.extra_names ?? '')
          .split(/[,，、\s]+/)
          .map(s => s.trim())
          .filter(Boolean);
        for (let i = 0; i < e.extra_count; i++) {
          rows.push({
            batch_id: batch.id,
            payee_name: names[i] ?? `${e.real_name} 的同行者 ${i + 1}`,
            payee_phone: null,
            amount_due: amount,
            amount_paid: 0,
          });
        }
      });

      if (rows.length > 0) {
        const { error: itemErr } = await supabase.from('payment_items').insert(rows);
        if (itemErr) {
          alert(`收款項目已建立，但名單寫入失敗：${itemErr.message}`);
          return;
        }
      }
      alert(`已建立收款項目「${sheet.title}」，共 ${rows.length} 筆。\n請到「收款管理」進行收款。`);
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="space-y-6 text-gray-900">
      <div>
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-red-600 flex items-center gap-1 mb-2">
          <ArrowLeft size={14} /> 接龍報名
        </button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{sheet.title}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {activity ? `${activity.date} ${activity.title}` : '自由主題'}
              {sheet.fee > 0 && ` · 每人 NT$ ${sheet.fee.toLocaleString('zh-TW')}`}
              {sheet.deadline && ` · 截止 ${fmt(sheet.deadline)}`}
              {sheet.status === 'closed' && ' · 已結束'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onCopyLink}
              className="flex items-center gap-2 border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 font-bold text-gray-700"
            >
              <Link2 size={18} /> 複製連結
            </button>
            {canEdit && (
              <>
                <button
                  onClick={onEdit}
                  className="flex items-center gap-2 border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 font-bold text-gray-700"
                >
                  <Pencil size={18} /> 編輯
                </button>
                <button
                  onClick={() => setAddOpen(true)}
                  className="flex items-center gap-2 border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 font-bold text-gray-700"
                >
                  <UserPlus size={18} /> 代為報名
                </button>
                <button
                  onClick={convertToPayment}
                  disabled={converting || entries.length === 0}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50"
                >
                  <Wallet size={18} /> 轉成收款
                </button>
                <button
                  onClick={onToggleStatus}
                  className="border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 font-bold text-gray-700"
                >
                  {sheet.status === 'open' ? '結束接龍' : '重新開放'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border">
          <div className="text-xs text-gray-400 font-bold uppercase">總人頭</div>
          <div className="text-2xl font-bold text-gray-800">
            {head}
            {sheet.max_people !== null && <span className="text-base text-gray-300"> / {sheet.max_people}</span>}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border">
          <div className="text-xs text-gray-400 font-bold uppercase">報名筆數</div>
          <div className="text-2xl font-bold text-gray-800">{entries.length}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <div className="text-xs text-blue-600 font-bold uppercase">來賓</div>
          <div className="text-2xl font-bold text-blue-700">{entries.filter(e => !e.member_id).length}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4 w-12">#</th>
                <th className="px-6 py-4">姓名</th>
                <th className="px-6 py-4">聯絡資訊</th>
                <th className="px-6 py-4">同行</th>
                <th className="px-6 py-4">備註</th>
                <th className="px-6 py-4">報名時間</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map((e, i) => {
                const member = members.find(m => String(m.id) === String(e.member_id));
                return (
                  <tr key={e.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 text-gray-300 font-bold">{i + 1}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 flex items-center gap-2">
                        {e.real_name}
                        {!e.member_id && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">來賓</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {member?.group_name || e.company || '—'}
                        {e.referrer && ` · 引薦：${e.referrer}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className="font-mono text-gray-600">{e.phone || member?.mobile_phone || '—'}</div>
                      {e.display_name && e.display_name !== e.real_name && (
                        <div className="text-gray-300">LINE：{e.display_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {e.extra_count > 0 ? (
                        <>
                          <span className="font-bold text-gray-700">+{e.extra_count}</span>
                          {e.extra_names && <div className="text-xs text-gray-400">{e.extra_names}</div>}
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 max-w-[160px]">{e.note || '—'}</td>
                    <td className="px-6 py-4 text-xs text-gray-400 whitespace-nowrap">{fmt(e.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      {canEdit && (
                        <button
                          onClick={() => removeEntry(e)}
                          className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg"
                          title="移除"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {entries.length === 0 && <div className="p-10 text-center text-gray-400">還沒有人報名</div>}
        </div>
      </div>

      {canEdit && (
        <button onClick={onDelete} className="text-xs text-gray-300 hover:text-red-500 font-bold">
          刪除這個接龍
        </button>
      )}

      {addOpen && (
        <ManualEntryModal
          sheet={sheet}
          members={members}
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
};

/* ---------------- 建立接龍 ---------------- */

// DB 的 timestamptz → datetime-local 要的「台北當地時間」字串
const toLocalInput = (iso?: string | null): string => {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
  return parts.replace(' ', 'T'); // sv-SE 給的是 'YYYY-MM-DD HH:mm'
};

const SheetFormModal: React.FC<{
  sheet: Sheet | null; // null = 建立，有值 = 編輯
  activities: Activity[];
  currentUser: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}> = ({ sheet, activities, currentUser, onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const isEdit = !!sheet;

  // 這幾個欄位會被「綁定活動」連動，所以要用受控元件
  const [title, setTitle] = useState(sheet?.title ?? '');
  const [activityId, setActivityId] = useState(sheet?.activity_id ? String(sheet.activity_id) : '');
  const [fee, setFee] = useState(String(sheet?.fee ?? 0));
  const [deadline, setDeadline] = useState(toLocalInput(sheet?.deadline));

  const boundActivity = activities.find(a => String(a.id) === activityId);
  // 幹部可能刻意改成跟活動不同的金額（例如只收餐費），所以不鎖死，只在不一致時提醒
  const feeDiffers = !!boundActivity && Number(fee || 0) !== Number(boundActivity.price ?? 0);

  // 選了活動就把活動資訊帶過來，避免接龍與活動各說各話
  const pickActivity = (id: string) => {
    setActivityId(id);
    const act = activities.find(a => String(a.id) === id);
    if (!act) return;
    setFee(String(act.price ?? 0));
    if (act.date) setDeadline(`${act.date}T${act.time || '00:00'}`);
    if (!title.trim()) setTitle(act.title);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!title.trim()) return;
    const maxRaw = String(f.get('max_people') || '').trim();

    const payload = {
      title: title.trim(),
      description: String(f.get('description') || '').trim() || null,
      activity_id: activityId ? Number(activityId) : null,
      // datetime-local 沒有時區，會以瀏覽器所在時區解讀（幹部都在台灣，等同台北時間）
      deadline: deadline ? new Date(deadline).toISOString() : null,
      max_people: maxRaw ? Number(maxRaw) : null,
      fee: Number(fee || 0),
      allow_guests: f.get('allow_guests') === 'on',
      allow_non_members: f.get('allow_non_members') === 'on',
    };

    setSaving(true);
    try {
      const { error } = isEdit
        ? await supabase.from('signup_sheets').update(payload).eq('id', sheet!.id)
        : await supabase
            .from('signup_sheets')
            .insert([{ ...payload, status: 'open', created_by: currentUser.name }]);
      if (error) {
        alert((isEdit ? '儲存失敗：' : '建立失敗：') + error.message);
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl p-6 my-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">{isEdit ? '編輯接龍' : '建立接龍'}</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
            <X size={22} />
          </button>
        </div>

        {isEdit && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mb-4">
            報名連結不會變，已經貼到群組的連結照樣可用。已報名的人不受影響。
          </p>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">綁定活動（選填）</label>
            <select
              value={activityId}
              onChange={e => pickActivity(e.target.value)}
              className="w-full border rounded-lg px-3 py-3 bg-white outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">不綁定（自由主題）</option>
              {activities.map(a => (
                <option key={a.id} value={a.id}>
                  {a.date} {a.title}
                </option>
              ))}
            </select>
            {boundActivity && (
              <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                報名頁會直接顯示活動的日期時間與地點：
                {boundActivity.date} {boundActivity.time} · {boundActivity.location}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">主題 *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
              placeholder="例：9/5 例會後聚餐"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">說明</label>
            <textarea
              name="description"
              rows={2}
              defaultValue={sheet?.description ?? ''}
              className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
              placeholder="注意事項、集合方式…（時間地點費用不用重打，會自動顯示）"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">每人費用</label>
              <input
                type="number"
                min={0}
                value={fee}
                onChange={e => setFee(e.target.value)}
                className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">人數上限</label>
              <input
                name="max_people"
                type="number"
                min={1}
                placeholder="不限"
                defaultValue={sheet?.max_people ?? ''}
                className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">截止時間</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          {feeDiffers ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              ⚠️ 活動「{boundActivity!.title}」的金額是 NT$ {Number(boundActivity!.price ?? 0).toLocaleString('zh-TW')}，
              這裡設定的是 NT$ {Number(fee || 0).toLocaleString('zh-TW')}。報名頁會顯示這裡的金額。
            </p>
          ) : (
            <p className="text-[11px] text-gray-400">每人費用填 0 就是免費，報名頁不會顯示金額。</p>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" name="allow_guests" defaultChecked={sheet ? sheet.allow_guests : true} /> 可以帶眷屬／朋友
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" name="allow_non_members" defaultChecked={sheet ? sheet.allow_non_members : true} /> 非會員也能報名（需填姓名電話）
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border py-3 rounded-lg font-bold text-gray-500 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? '儲存中…' : isEdit ? '儲存變更' : '建立'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ---------------- 代為報名 ---------------- */

const ManualEntryModal: React.FC<{
  sheet: Sheet;
  members: Member[];
  onClose: () => void;
  onAdded: () => void;
}> = ({ sheet, members, onClose, onAdded }) => {
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Member | null>(null);

  const results = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return [];
    return members
      .filter(m => (m.status ?? 'active') === 'active')
      .filter(m => m.name.toLowerCase().includes(t) || (m.company ?? '').toLowerCase().includes(t))
      .slice(0, 8);
  }, [search, members]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const realName = String(f.get('real_name') || '').trim();
    if (!realName) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('signup_entries').insert([
        {
          sheet_id: sheet.id,
          line_user_id: null, // 後台代報，沒有 LINE 身分
          member_id: picked ? Number(picked.id) : null,
          display_name: null,
          real_name: realName,
          phone: String(f.get('phone') || '').trim() || null,
          company: String(f.get('company') || '').trim() || null,
          referrer: String(f.get('referrer') || '').trim() || null,
          extra_count: Number(f.get('extra_count') || 0),
          extra_names: String(f.get('extra_names') || '').trim() || null,
          note: String(f.get('note') || '').trim() || null,
        },
      ]);
      if (error) {
        alert('新增失敗：' + error.message);
        return;
      }
      onAdded();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 my-8">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold">代為報名</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-5">幫當下沒看手機的人登記。搜尋會員可自動帶入資料。</p>

        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              搜尋會員 <span className="text-gray-300 font-medium">選填</span>
            </label>
            <input
              value={picked ? picked.name : search}
              onChange={e => {
                setPicked(null);
                setSearch(e.target.value);
              }}
              className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
              placeholder="打名字搜尋，或留空直接填底下欄位"
            />
            {!picked && results.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {results.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setPicked(m);
                      setSearch('');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-red-50 text-sm"
                  >
                    <span className="font-bold text-gray-800">{m.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{m.company}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">姓名 *</label>
            <input
              name="real_name"
              required
              key={picked?.id ?? 'none'}
              defaultValue={picked?.name ?? ''}
              className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">電話</label>
              <input
                name="phone"
                key={`p-${picked?.id ?? 'none'}`}
                defaultValue={picked?.mobile_phone ?? ''}
                className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">再帶幾位</label>
              <input
                name="extra_count"
                type="number"
                min={0}
                defaultValue={0}
                disabled={!sheet.allow_guests}
                className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">公司</label>
              <input
                name="company"
                key={`c-${picked?.id ?? 'none'}`}
                defaultValue={picked?.company ?? ''}
                className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">引薦人</label>
              <input name="referrer" className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">同行者姓名</label>
            <input name="extra_names" className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">備註</label>
            <input name="note" className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border py-3 rounded-lg font-bold text-gray-500 hover:bg-gray-50">
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check size={16} /> {saving ? '新增中…' : '新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignupManager;
