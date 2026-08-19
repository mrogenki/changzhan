import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Wallet, CalendarPlus, Trash2, ChevronRight, AlertCircle, Search, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Activity, AdminUser, AttendanceRecord, Member, PaymentBatch, Registration } from '../../types';

interface Props {
  members: Member[];
  activities: Activity[];
  attendance: AttendanceRecord[];
  registrations: Registration[];
  currentUser: AdminUser;
}

// 只有金額欄位，列表統計用；不必把整份明細抓回來
type ItemStat = { batch_id: number; amount_due: number; amount_paid: number };

// 待建立的名單項目，送出前都還沒進資料庫
type DraftPayee = {
  key: string;
  payee_name: string;
  payee_phone?: string | null;
  member_id?: number | null;
  guest_id?: number | null;
  registration_id?: number | null;
  source: string; // 顯示用，例如「全體會員」「出席名單」
};

const MEAL_FEE_AMOUNT = 2800;
const FINANCE_CATEGORIES = ['會費', '活動費用', '其他'];

const taipeiToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const currentPeriod = () => taipeiToday().slice(0, 7); // YYYY-MM

const money = (n: number) => `NT$ ${n.toLocaleString('zh-TW')}`;

const PaymentManager: React.FC<Props> = ({ members, activities, attendance, registrations, currentUser }) => {
  const [batches, setBatches] = useState<PaymentBatch[]>([]);
  const [stats, setStats] = useState<ItemStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const activeMembers = useMemo(
    () => members.filter(m => (m.status ?? 'active') === 'active'),
    [members]
  );

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [batchRes, itemRes] = await Promise.all([
        supabase.from('payment_batches').select('*').order('created_at', { ascending: false }),
        supabase.from('payment_items').select('batch_id, amount_due, amount_paid'),
      ]);
      setBatches((batchRes.data ?? []) as PaymentBatch[]);
      setStats((itemRes.data ?? []) as ItemStat[]);
    } finally {
      setLoading(false);
    }
  }

  const statOf = (batchId: number) => {
    const rows = stats.filter(s => s.batch_id === batchId);
    const due = rows.reduce((sum, r) => sum + (r.amount_due || 0), 0);
    const paid = rows.reduce((sum, r) => sum + (r.amount_paid || 0), 0);
    const paidCount = rows.filter(r => r.amount_paid >= r.amount_due && r.amount_due > 0).length;
    return { due, paid, paidCount, total: rows.length };
  };

  // 實際建立：先寫項目、再寫明細
  async function createBatch(
    batch: Omit<PaymentBatch, 'id' | 'created_at'>,
    payees: DraftPayee[]
  ): Promise<boolean> {
    setCreating(true);
    try {
      const { data: created, error } = await supabase
        .from('payment_batches')
        .insert([batch])
        .select()
        .single();
      if (error || !created) {
        alert('建立收款項目失敗：' + (error?.message ?? ''));
        return false;
      }
      if (payees.length > 0) {
        const rows = payees.map(p => ({
          batch_id: created.id,
          payee_name: p.payee_name,
          payee_phone: p.payee_phone ?? null,
          member_id: p.member_id ?? null,
          guest_id: p.guest_id ?? null,
          registration_id: p.registration_id ?? null,
          amount_due: batch.default_amount,
          amount_paid: 0,
        }));
        const { error: itemErr } = await supabase.from('payment_items').insert(rows);
        if (itemErr) {
          // 項目已建立但名單沒進去，講清楚讓幹部知道要補
          alert(`收款項目已建立，但名單寫入失敗：${itemErr.message}\n請進入項目後用「加入名單」補上。`);
        }
      }
      await loadData();
      return true;
    } finally {
      setCreating(false);
    }
  }

  // 一鍵建立本月餐費：全體在籍會員、2800、期別本月
  async function createMonthlyMealFee() {
    const period = currentPeriod();
    if (batches.some(b => b.period === period)) {
      alert(`${period} 的餐費項目已經存在了`);
      return;
    }
    if (
      !window.confirm(
        `建立「${period} 餐費」\n\n對象：全體在籍會員 ${activeMembers.length} 位\n金額：每人 ${money(MEAL_FEE_AMOUNT)}\n\n確定嗎？`
      )
    )
      return;

    await createBatch(
      {
        title: `${period} 餐費`,
        default_amount: MEAL_FEE_AMOUNT,
        period,
        activity_id: null,
        due_date: null,
        finance_category: '會費',
        status: 'open',
        note: null,
        created_by: currentUser.name,
      },
      activeMembers.map(m => ({
        key: `m-${m.id}`,
        payee_name: m.name,
        payee_phone: m.mobile_phone ?? null,
        member_id: Number(m.id),
        source: '全體會員',
      }))
    );
  }

  async function deleteBatch(batch: PaymentBatch) {
    const s = statOf(batch.id);
    if (
      !window.confirm(
        `確定要刪除「${batch.title}」嗎？\n\n底下 ${s.total} 筆收款明細會一併刪除（已收 ${money(s.paid)}），無法復原。`
      )
    )
      return;
    const { error } = await supabase.from('payment_batches').delete().eq('id', batch.id);
    if (error) alert('刪除失敗：' + error.message);
    else loadData();
  }

  async function toggleStatus(batch: PaymentBatch) {
    const next = batch.status === 'open' ? 'closed' : 'open';
    const { error } = await supabase.from('payment_batches').update({ status: next }).eq('id', batch.id);
    if (error) alert('更新失敗：' + error.message);
    else loadData();
  }

  if (loading) return <div className="p-10 text-center text-gray-400">載入收款資料中...</div>;

  const openBatches = batches.filter(b => b.status === 'open');
  const totalOutstanding = openBatches.reduce((sum, b) => {
    const s = statOf(b.id);
    return sum + Math.max(0, s.due - s.paid);
  }, 0);

  return (
    <div className="space-y-6 text-gray-900">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet size={24} className="text-red-600" /> 收款管理
          </h1>
          <p className="text-gray-500 text-sm">每月餐費與各項活動收費，記錄繳費進度與方式。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={createMonthlyMealFee}
            disabled={creating}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <CalendarPlus size={18} /> 建立本月餐費
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors font-bold text-gray-700"
          >
            <Plus size={18} /> 新增收款項目
          </button>
        </div>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border">
          <div className="text-xs text-gray-400 font-bold uppercase">進行中項目</div>
          <div className="text-2xl font-bold text-gray-800">{openBatches.length}</div>
        </div>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
          <div className="text-xs text-amber-600 font-bold uppercase">尚未收齊</div>
          <div className="text-2xl font-bold text-amber-700">{money(totalOutstanding)}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
          <div className="text-xs text-green-600 font-bold uppercase">累計已收</div>
          <div className="text-2xl font-bold text-green-700">
            {money(stats.reduce((sum, s) => sum + (s.amount_paid || 0), 0))}
          </div>
        </div>
      </div>

      {/* 項目列表 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">收款項目</th>
                <th className="px-6 py-4">人數</th>
                <th className="px-6 py-4">應收 / 已收</th>
                <th className="px-6 py-4 min-w-[160px]">進度</th>
                <th className="px-6 py-4">狀態</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {batches.map(b => {
                const s = statOf(b.id);
                const pct = s.due > 0 ? Math.round((s.paid / s.due) * 100) : 0;
                const activity = activities.find(a => String(a.id) === String(b.activity_id));
                return (
                  <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <Link to={`/admin/payments/${b.id}`} className="font-bold text-gray-900 hover:text-red-600">
                        {b.title}
                      </Link>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {b.period && <span className="mr-2">期別 {b.period}</span>}
                        {activity && <span className="mr-2">活動：{activity.title}</span>}
                        {b.due_date && <span>期限 {b.due_date}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {s.paidCount} / {s.total}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      <span className="text-gray-500">{money(s.due)}</span>
                      <span className="mx-1 text-gray-300">/</span>
                      <span className="font-bold text-green-600">{money(s.paid)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-grow h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-500 w-10 text-right">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleStatus(b)}
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          b.status === 'open' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                        }`}
                        title="點擊切換"
                      >
                        {b.status === 'open' ? '進行中' : '已結清'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Link
                        to={`/admin/payments/${b.id}`}
                        className="inline-flex items-center gap-1 text-sm font-bold text-red-600 hover:underline mr-2"
                      >
                        收款 <ChevronRight size={14} />
                      </Link>
                      <button
                        onClick={() => deleteBatch(b)}
                        className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors align-middle"
                        title="刪除項目"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {batches.length === 0 && (
            <div className="p-10 text-center text-gray-400">
              還沒有收款項目。點右上角「建立本月餐費」開始。
            </div>
          )}
        </div>
      </div>

      <UnpaidOverview batches={openBatches} members={members} />

      {modalOpen && (
        <CreateBatchModal
          members={activeMembers}
          activities={activities}
          attendance={attendance}
          registrations={registrations}
          currentUser={currentUser}
          creating={creating}
          onClose={() => setModalOpen(false)}
          onCreate={async (batch, payees) => {
            const ok = await createBatch(batch, payees);
            if (ok) setModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

/* ---------------- 跨項目未繳一覽 ---------------- */

const UnpaidOverview: React.FC<{ batches: PaymentBatch[]; members: Member[] }> = ({ batches, members }) => {
  const [rows, setRows] = useState<Array<{ name: string; group: string; count: number; amount: number }>>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || batches.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from('payment_items')
        .select('payee_name, member_id, amount_due, amount_paid, batch_id')
        .in('batch_id', batches.map(b => b.id));
      const map = new Map<string, { name: string; group: string; count: number; amount: number }>();
      (data ?? []).forEach((it: any) => {
        const owed = (it.amount_due || 0) - (it.amount_paid || 0);
        if (owed <= 0) return;
        const key = it.member_id ? `m-${it.member_id}` : `n-${it.payee_name}`;
        const member = members.find(m => String(m.id) === String(it.member_id));
        const prev = map.get(key) ?? {
          name: it.payee_name,
          group: member?.group_name ?? '',
          count: 0,
          amount: 0,
        };
        prev.count += 1;
        prev.amount += owed;
        map.set(key, prev);
      });
      setRows(Array.from(map.values()).sort((a, b) => b.amount - a.amount));
    })();
  }, [open, batches, members]);

  if (batches.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <span className="font-bold text-gray-900 flex items-center gap-2">
          <AlertCircle size={18} className="text-amber-500" /> 跨項目未繳一覽
        </span>
        <span className="text-xs text-gray-400 font-bold">{open ? '收合' : '展開'}</span>
      </button>
      {open && (
        <div className="border-t border-gray-100">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-gray-400 text-sm">所有進行中項目都收齊了</p>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs font-bold text-gray-400 uppercase">
                  <th className="px-6 py-3">姓名</th>
                  <th className="px-6 py-3">組別</th>
                  <th className="px-6 py-3">未繳筆數</th>
                  <th className="px-6 py-3 text-right">未繳金額</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3 font-bold text-gray-800">{r.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{r.group || '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{r.count}</td>
                    <td className="px-6 py-3 text-right font-bold text-amber-600">{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

/* ---------------- 建立收款項目 ---------------- */

const CreateBatchModal: React.FC<{
  members: Member[];
  activities: Activity[];
  attendance: AttendanceRecord[];
  registrations: Registration[];
  currentUser: AdminUser;
  creating: boolean;
  onClose: () => void;
  onCreate: (batch: Omit<PaymentBatch, 'id' | 'created_at'>, payees: DraftPayee[]) => void;
}> = ({ members, activities, attendance, registrations, currentUser, creating, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState(2800);
  const [period, setPeriod] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [activityId, setActivityId] = useState('');
  const [category, setCategory] = useState('活動費用');

  const [payees, setPayees] = useState<DraftPayee[]>([]);
  const [search, setSearch] = useState('');
  const [manualName, setManualName] = useState('');
  const [groupPick, setGroupPick] = useState('');
  const [sourceActivityId, setSourceActivityId] = useState('');

  const groups = useMemo(
    () => Array.from(new Set(members.map(m => m.group_name).filter(Boolean))).sort() as string[],
    [members]
  );

  const addPayees = (list: DraftPayee[]) => {
    setPayees(prev => {
      const seen = new Set(prev.map(p => p.key));
      return [...prev, ...list.filter(p => !seen.has(p.key))];
    });
  };

  const memberPayee = (m: Member, source: string): DraftPayee => ({
    key: `m-${m.id}`,
    payee_name: m.name,
    payee_phone: m.mobile_phone ?? null,
    member_id: Number(m.id),
    source,
  });

  const addAllMembers = () => addPayees(members.map(m => memberPayee(m, '全體會員')));

  const addGroup = () => {
    if (!groupPick) return;
    addPayees(members.filter(m => m.group_name === groupPick).map(m => memberPayee(m, groupPick)));
  };

  // 從出席名單帶入：會員取自 attendance，來賓取自該活動已報到的報名紀錄
  const addFromActivity = () => {
    if (!sourceActivityId) return;
    const memberIds = attendance
      .filter(a => String(a.activity_id) === sourceActivityId && a.status !== 'absent')
      .map(a => String(a.member_id));
    const fromMembers = members
      .filter(m => memberIds.includes(String(m.id)))
      .map(m => memberPayee(m, '出席名單'));
    const fromGuests: DraftPayee[] = registrations
      .filter(r => String(r.activityId) === sourceActivityId && r.check_in_status)
      .map(r => ({
        key: `r-${r.id}`,
        payee_name: r.name,
        payee_phone: r.phone ?? null,
        registration_id: Number(r.id),
        source: '出席名單（來賓）',
      }));
    if (fromMembers.length + fromGuests.length === 0) {
      alert('這場活動還沒有出席紀錄，請改用手動勾選。');
      return;
    }
    addPayees([...fromMembers, ...fromGuests]);
  };

  const addManual = () => {
    const name = manualName.trim();
    if (!name) return;
    addPayees([{ key: `x-${name}-${Date.now()}`, payee_name: name, source: '手動輸入' }]);
    setManualName('');
  };

  const searchResults = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return [];
    const chosen = new Set(payees.map(p => p.key));
    const fromMembers = members
      .filter(m => m.name.toLowerCase().includes(t) || (m.company ?? '').toLowerCase().includes(t))
      .map(m => memberPayee(m, '手動勾選'));
    const fromRegs: DraftPayee[] = registrations
      .filter(r => r.name.toLowerCase().includes(t) || (r.phone ?? '').includes(t))
      .map(r => ({
        key: `r-${r.id}`,
        payee_name: r.name,
        payee_phone: r.phone ?? null,
        registration_id: Number(r.id),
        source: '來賓',
      }));
    // 同一位來賓可能有多筆報名，只留一筆
    const dedup = new Map<string, DraftPayee>();
    [...fromMembers, ...fromRegs].forEach(p => {
      if (chosen.has(p.key)) return;
      const nameKey = p.member_id ? p.key : `name-${p.payee_name}-${p.payee_phone}`;
      if (!dedup.has(nameKey)) dedup.set(nameKey, p);
    });
    return Array.from(dedup.values()).slice(0, 12);
  }, [search, members, registrations, payees]);

  const submit = () => {
    if (!title.trim()) {
      alert('請填收款項目名稱');
      return;
    }
    if (payees.length === 0 && !window.confirm('名單是空的，確定要先建立空項目嗎？（之後可再加入名單）')) return;
    onCreate(
      {
        title: title.trim(),
        default_amount: Number(amount) || 0,
        period: period.trim() || null,
        activity_id: activityId ? Number(activityId) : null,
        due_date: dueDate || null,
        finance_category: category,
        status: 'open',
        note: null,
        created_by: currentUser.name,
      },
      payees
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl p-6 my-8">
        <h2 className="text-xl font-bold mb-1">新增收款項目</h2>
        <p className="text-xs text-gray-500 mb-5">例如「2026 春酒晚宴」「商務培訓分攤」。每月餐費請用「建立本月餐費」。</p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">項目名稱 *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
                placeholder="2026 春酒晚宴"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">每人金額</label>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">繳費期限</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">關聯活動</label>
              <select
                value={activityId}
                onChange={e => setActivityId(e.target.value)}
                className="w-full border rounded-lg px-3 py-3 bg-white outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">不關聯</option>
                {activities.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.date} {a.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">寫入收支時的分類</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full border rounded-lg px-3 py-3 bg-white outline-none focus:ring-2 focus:ring-red-500"
              >
                {FINANCE_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 名單來源 */}
          <div className="border-t pt-4">
            <p className="text-sm font-bold text-gray-700 mb-3">
              收款名單 <span className="text-red-600">已選 {payees.length} 人</span>
            </p>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={addAllMembers}
                  className="text-xs font-bold border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50"
                >
                  ＋ 全體在籍會員（{members.length}）
                </button>

                <div className="flex items-center gap-1">
                  <select
                    value={groupPick}
                    onChange={e => setGroupPick(e.target.value)}
                    className="text-xs border rounded-lg px-2 py-2 bg-white"
                  >
                    <option value="">選組別…</option>
                    {groups.map(g => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addGroup}
                    disabled={!groupPick}
                    className="text-xs font-bold border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    ＋ 加入
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <select
                    value={sourceActivityId}
                    onChange={e => setSourceActivityId(e.target.value)}
                    className="text-xs border rounded-lg px-2 py-2 bg-white max-w-[180px]"
                  >
                    <option value="">從出席名單…</option>
                    {activities.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.date} {a.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addFromActivity}
                    disabled={!sourceActivityId}
                    className="text-xs font-bold border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    ＋ 帶入
                  </button>
                </div>
              </div>

              {/* 手動勾選 */}
              <div className="relative">
                <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
                  <Search size={16} className="text-gray-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="搜尋會員或來賓姓名，點擊加入…"
                    className="flex-grow outline-none text-sm"
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {searchResults.map(r => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => {
                          addPayees([r]);
                          setSearch('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-red-50 text-sm flex justify-between items-center"
                      >
                        <span className="font-bold text-gray-800">{r.payee_name}</span>
                        <span className="text-[10px] text-gray-400">{r.source}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addManual();
                    }
                  }}
                  placeholder="名單以外的人（例如會員家屬）直接打名字"
                  className="flex-grow border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  type="button"
                  onClick={addManual}
                  className="text-xs font-bold border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                >
                  ＋ 加入
                </button>
              </div>

              {/* 已選名單 */}
              {payees.length > 0 && (
                <div className="border rounded-lg p-3 max-h-44 overflow-y-auto bg-gray-50/60">
                  <div className="flex flex-wrap gap-1.5">
                    {payees.map(p => (
                      <span
                        key={p.key}
                        className="inline-flex items-center gap-1 bg-white border rounded-full pl-2.5 pr-1 py-1 text-xs"
                      >
                        {p.payee_name}
                        <button
                          type="button"
                          onClick={() => setPayees(prev => prev.filter(x => x.key !== p.key))}
                          className="text-gray-300 hover:text-red-500"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPayees([])}
                    className="text-[11px] text-gray-400 hover:text-red-500 mt-2 font-bold"
                  >
                    清空名單
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="flex-1 border py-3 rounded-lg font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={creating}
              className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50"
            >
              {creating ? '建立中…' : `建立（${payees.length} 人）`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentManager;
