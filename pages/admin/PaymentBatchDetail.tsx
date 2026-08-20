import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Banknote, Search, Trash2, UserPlus, X, Check } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import {
  AdminUser,
  Member,
  PaymentBatch,
  PaymentItem,
  PaymentMethod,
  PAYMENT_METHOD_LABEL,
  Registration,
} from '../../types';

interface Props {
  canEdit: boolean;
  members: Member[];
  registrations: Registration[];
  currentUser: AdminUser;
}

const METHODS: PaymentMethod[] = ['cash', 'linepay', 'transfer'];

const METHOD_STYLE: Record<PaymentMethod, string> = {
  cash: 'bg-emerald-100 text-emerald-700',
  linepay: 'bg-green-100 text-green-700',
  transfer: 'bg-blue-100 text-blue-700',
};

const money = (n: number) => `NT$ ${n.toLocaleString('zh-TW')}`;

const taipeiToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'short', timeStyle: 'short' }) : '';

const PaymentBatchDetail: React.FC<Props> = ({ canEdit, members, registrations, currentUser }) => {
  const { batchId } = useParams<{ batchId: string }>();
  const [batch, setBatch] = useState<PaymentBatch | null>(null);
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [groupFilter, setGroupFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<PaymentItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [writingFinance, setWritingFinance] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  async function load() {
    if (!batchId) return;
    setLoading(true);
    try {
      const [b, i] = await Promise.all([
        supabase.from('payment_batches').select('*').eq('id', batchId).maybeSingle(),
        supabase.from('payment_items').select('*').eq('batch_id', batchId).order('payee_name'),
      ]);
      setBatch((b.data ?? null) as PaymentBatch | null);
      setItems((i.data ?? []) as PaymentItem[]);
    } finally {
      setLoading(false);
    }
  }

  // member_id → 組別，用於篩選與顯示
  const groupOf = (item: PaymentItem) =>
    members.find(m => String(m.id) === String(item.member_id))?.group_name ?? '';

  const groups = useMemo(
    () => Array.from(new Set(items.map(groupOf).filter(Boolean))).sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, members]
  );

  const visible = items.filter(it => {
    const paid = it.amount_paid >= it.amount_due && it.amount_due > 0;
    if (filter === 'paid' && !paid) return false;
    if (filter === 'unpaid' && paid) return false;
    if (groupFilter && groupOf(it) !== groupFilter) return false;
    if (search && !it.payee_name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  // 統計跟著目前的篩選走，選了組別就是那一組的進度
  const stat = useMemo(() => {
    const due = visible.reduce((s, i) => s + (i.amount_due || 0), 0);
    const paid = visible.reduce((s, i) => s + (i.amount_paid || 0), 0);
    const paidCount = visible.filter(i => i.amount_paid >= i.amount_due && i.amount_due > 0).length;
    return { due, paid, paidCount, total: visible.length };
  }, [visible]);

  async function markPaid(item: PaymentItem, method: PaymentMethod) {
    const { error } = await supabase
      .from('payment_items')
      .update({
        amount_paid: item.amount_due,
        method,
        paid_at: new Date().toISOString(),
        recorded_by: currentUser.name,
      })
      .eq('id', item.id);
    if (error) alert('標記失敗：' + error.message);
    else load();
  }

  async function undoPaid(item: PaymentItem) {
    if (!window.confirm(`要把「${item.payee_name}」改回未繳嗎？`)) return;
    const { error } = await supabase
      .from('payment_items')
      .update({ amount_paid: 0, method: null, paid_at: null, recorded_by: null })
      .eq('id', item.id);
    if (error) alert('操作失敗：' + error.message);
    else load();
  }

  async function saveEdit(patch: Partial<PaymentItem>) {
    if (!editing) return;
    const { error } = await supabase.from('payment_items').update(patch).eq('id', editing.id);
    if (error) {
      alert('儲存失敗：' + error.message);
      return;
    }
    setEditing(null);
    load();
  }

  async function removeItem(item: PaymentItem) {
    if (!window.confirm(`確定要把「${item.payee_name}」從這個收款項目移除嗎？`)) return;
    const { error } = await supabase.from('payment_items').delete().eq('id', item.id);
    if (error) alert('移除失敗：' + error.message);
    else load();
  }

  // 寫入收支管理：一個項目對應一筆收入，重複寫入是更新而不是新增
  async function writeToFinance() {
    if (!batch) return;
    const total = items.reduce((s, i) => s + (i.amount_paid || 0), 0);
    if (total <= 0) {
      alert('目前還沒有收到任何款項');
      return;
    }
    if (!window.confirm(`把「${batch.title}」目前已收的 ${money(total)} 寫入收支管理嗎？\n\n分類：${batch.finance_category}\n（同一項目重複寫入會更新金額，不會重複記帳）`))
      return;

    setWritingFinance(true);
    try {
      const { data: existing } = await supabase
        .from('finance_records')
        .select('id')
        .eq('payment_batch_id', batch.id)
        .maybeSingle();

      const payload = {
        type: 'income',
        category: batch.finance_category,
        amount: total,
        date: taipeiToday(),
        description: `${batch.title}（收款 ${items.filter(i => i.amount_paid > 0).length} 筆）`,
        activity_id: batch.activity_id ?? null,
        payment_batch_id: batch.id,
      };

      const { error } = existing
        ? await supabase.from('finance_records').update(payload).eq('id', existing.id)
        : await supabase.from('finance_records').insert([payload]);

      if (error) alert('寫入收支失敗：' + error.message);
      else alert(existing ? '已更新收支管理中的紀錄' : '已寫入收支管理');
    } finally {
      setWritingFinance(false);
    }
  }

  if (loading) return <div className="p-10 text-center text-gray-400">載入中...</div>;
  if (!batch)
    return (
      <div className="p-10 text-center text-gray-400">
        找不到這個收款項目。
        <Link to="/admin/payments" className="text-red-600 font-bold ml-2">
          回列表
        </Link>
      </div>
    );

  const pct = stat.due > 0 ? Math.round((stat.paid / stat.due) * 100) : 0;

  return (
    <div className="space-y-6 text-gray-900">
      <div>
        <Link to="/admin/payments" className="text-sm text-gray-400 hover:text-red-600 flex items-center gap-1 mb-2">
          <ArrowLeft size={14} /> 收款管理
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{batch.title}</h1>
            <p className="text-gray-500 text-sm mt-1">
              每人 {money(batch.default_amount)}
              {batch.due_date && ` · 期限 ${batch.due_date}`}
              {batch.period && ` · 期別 ${batch.period}`}
              {batch.status === 'closed' && ' · 已結清'}
            </p>
          </div>
          <div className={`flex flex-wrap gap-2 ${canEdit ? '' : 'hidden'}`}>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 font-bold text-gray-700"
            >
              <UserPlus size={18} /> 加入名單
            </button>
            <button
              onClick={writeToFinance}
              disabled={writingFinance}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50"
            >
              <Banknote size={18} /> {writingFinance ? '寫入中…' : '寫入收支'}
            </button>
          </div>
        </div>
      </div>

      {/* 統計（跟著篩選走） */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border">
          <div className="text-xs text-gray-400 font-bold uppercase">應收</div>
          <div className="text-xl font-bold text-gray-800">{money(stat.due)}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
          <div className="text-xs text-green-600 font-bold uppercase">已收</div>
          <div className="text-xl font-bold text-green-700">{money(stat.paid)}</div>
        </div>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
          <div className="text-xs text-amber-600 font-bold uppercase">未收</div>
          <div className="text-xl font-bold text-amber-700">{money(Math.max(0, stat.due - stat.paid))}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <div className="text-xs text-blue-600 font-bold uppercase">繳費率</div>
          <div className="text-xl font-bold text-blue-700">
            {stat.paidCount} / {stat.total}
            <span className="text-sm font-bold ml-2">{pct}%</span>
          </div>
        </div>
      </div>

      {/* 篩選 */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-4 rounded-xl border">
        <div className="flex items-center gap-2 flex-grow">
          <Search size={18} className="text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜尋姓名…"
            className="bg-transparent outline-none w-full text-sm"
          />
        </div>
        {groups.length > 0 && (
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-xs font-bold bg-white"
          >
            <option value="">所有組別</option>
            {groups.map(g => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-1">
          {(['all', 'unpaid', 'paid'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filter === f ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? '全部' : f === 'unpaid' ? '未繳' : '已繳'}
            </button>
          ))}
        </div>
      </div>

      {/* 明細 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">姓名</th>
                <th className="px-6 py-4">應繳 / 已繳</th>
                <th className="px-6 py-4 min-w-[220px]">繳費狀態</th>
                <th className="px-6 py-4">備註</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.map(it => {
                const paid = it.amount_paid >= it.amount_due && it.amount_due > 0;
                const partial = it.amount_paid > 0 && !paid;
                const group = groupOf(it);
                return (
                  <tr key={it.id} className={`hover:bg-gray-50/50 transition-colors ${paid ? 'bg-green-50/20' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{it.payee_name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {it.member_id ? group || '會員' : '來賓／其他'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      <span className="text-gray-500">{money(it.amount_due)}</span>
                      <span className="mx-1 text-gray-300">/</span>
                      <span className={`font-bold ${paid ? 'text-green-600' : partial ? 'text-amber-600' : 'text-gray-300'}`}>
                        {money(it.amount_paid)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {it.amount_paid > 0 ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              it.method ? METHOD_STYLE[it.method] : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {it.method ? PAYMENT_METHOD_LABEL[it.method] : '已收'}
                          </span>
                          {partial && (
                            <span className="px-2 py-1 rounded text-xs font-bold bg-amber-100 text-amber-700">部分</span>
                          )}
                          <span className="text-[11px] text-gray-400">
                            {fmtDateTime(it.paid_at)}
                            {it.recorded_by && ` · ${it.recorded_by}`}
                          </span>
                          {canEdit && (
                            <button
                              onClick={() => undoPaid(it)}
                              className="text-[11px] text-gray-300 hover:text-red-500 font-bold"
                            >
                              撤銷
                            </button>
                          )}
                        </div>
                      ) : !canEdit ? (
                        <span className="text-xs text-gray-300 font-bold">未繳</span>
                      ) : (
                        <div className="flex gap-1">
                          {METHODS.map(m => (
                            <button
                              key={m}
                              onClick={() => markPaid(it, m)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border border-transparent hover:border-current transition ${METHOD_STYLE[m]}`}
                              title={`標記為已用${PAYMENT_METHOD_LABEL[m]}繳費`}
                            >
                              {PAYMENT_METHOD_LABEL[m]}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 max-w-[180px]">
                      <span className="line-clamp-2">{it.note || '—'}</span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {canEdit && (
                        <>
                          <button
                            onClick={() => setEditing(it)}
                            className="text-xs font-bold text-gray-500 hover:text-red-600 px-2 py-1"
                          >
                            編輯
                          </button>
                          <button
                            onClick={() => removeItem(it)}
                            className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors align-middle"
                            title="從名單移除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && (
            <div className="p-10 text-center text-gray-400">
              {items.length === 0 ? (canEdit ? '這個項目還沒有名單，點右上角「加入名單」。' : '這個項目還沒有名單。') : '沒有符合條件的資料'}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <EditItemModal item={editing} onClose={() => setEditing(null)} onSave={saveEdit} currentUser={currentUser} />
      )}

      {addOpen && (
        <AddPayeesModal
          batch={batch}
          existing={items}
          members={members}
          registrations={registrations}
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
};

/* ---------------- 編輯單筆 ---------------- */

const EditItemModal: React.FC<{
  item: PaymentItem;
  currentUser: AdminUser;
  onClose: () => void;
  onSave: (patch: Partial<PaymentItem>) => void;
}> = ({ item, currentUser, onClose, onSave }) => {
  const [due, setDue] = useState(item.amount_due);
  const [paid, setPaid] = useState(item.amount_paid);
  const [method, setMethod] = useState<PaymentMethod | ''>(item.method ?? '');
  const [note, setNote] = useState(item.note ?? '');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-1">{item.payee_name}</h3>
        <p className="text-xs text-gray-500 mb-5">金額不同（請假減免、補繳差額…）時在這裡調整。</p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">應繳</label>
              <input
                type="number"
                min={0}
                value={due}
                onChange={e => setDue(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">已繳</label>
              <input
                type="number"
                min={0}
                value={paid}
                onChange={e => setPaid(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">繳費方式</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value as PaymentMethod | '')}
              className="w-full border rounded-lg px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">未指定</option>
              {METHODS.map(m => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">備註</label>
            <textarea
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="例：請假折抵 700、○○組長代收"
              className="w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border py-2.5 rounded-lg font-bold text-gray-500 hover:bg-gray-50">
              取消
            </button>
            <button
              onClick={() =>
                onSave({
                  amount_due: due,
                  amount_paid: paid,
                  method: method || null,
                  note: note.trim() || null,
                  // 金額從 0 變成有值時補上時間與經手人，否則沿用原本的
                  paid_at: paid > 0 ? item.paid_at ?? new Date().toISOString() : null,
                  recorded_by: paid > 0 ? item.recorded_by ?? currentUser.name : null,
                })
              }
              className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-bold hover:bg-red-700"
            >
              儲存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- 追加名單 ---------------- */

const AddPayeesModal: React.FC<{
  batch: PaymentBatch;
  existing: PaymentItem[];
  members: Member[];
  registrations: Registration[];
  onClose: () => void;
  onAdded: () => void;
}> = ({ batch, existing, members, registrations, onClose, onAdded }) => {
  const [search, setSearch] = useState('');
  const [manualName, setManualName] = useState('');
  const [picked, setPicked] = useState<
    Array<{ key: string; payee_name: string; payee_phone?: string | null; member_id?: number | null; registration_id?: number | null }>
  >([]);
  const [saving, setSaving] = useState(false);

  const takenMembers = new Set(existing.map(e => String(e.member_id)).filter(Boolean));
  const takenRegs = new Set(existing.map(e => String(e.registration_id)).filter(Boolean));

  const results = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return [];
    const pickedKeys = new Set(picked.map(p => p.key));
    const out: typeof picked = [];
    members
      .filter(m => (m.status ?? 'active') === 'active')
      .filter(m => m.name.toLowerCase().includes(t) || (m.company ?? '').toLowerCase().includes(t))
      .forEach(m => {
        if (takenMembers.has(String(m.id))) return;
        out.push({ key: `m-${m.id}`, payee_name: m.name, payee_phone: m.mobile_phone ?? null, member_id: Number(m.id) });
      });
    const seenName = new Set<string>();
    registrations
      .filter(r => r.name.toLowerCase().includes(t) || (r.phone ?? '').includes(t))
      .forEach(r => {
        if (takenRegs.has(String(r.id))) return;
        const nk = `${r.name}-${r.phone}`;
        if (seenName.has(nk)) return;
        seenName.add(nk);
        out.push({ key: `r-${r.id}`, payee_name: r.name, payee_phone: r.phone ?? null, registration_id: Number(r.id) });
      });
    return out.filter(o => !pickedKeys.has(o.key)).slice(0, 12);
  }, [search, members, registrations, picked, takenMembers, takenRegs]);

  async function save() {
    if (picked.length === 0) return;
    setSaving(true);
    try {
      const rows = picked.map(p => ({
        batch_id: batch.id,
        payee_name: p.payee_name,
        payee_phone: p.payee_phone ?? null,
        member_id: p.member_id ?? null,
        registration_id: p.registration_id ?? null,
        amount_due: batch.default_amount,
        amount_paid: 0,
      }));
      const { error } = await supabase.from('payment_items').insert(rows);
      if (error) {
        alert('加入失敗：' + error.message);
        return;
      }
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-1">加入名單</h3>
        <p className="text-xs text-gray-500 mb-4">加入後應繳金額預設為 {money(batch.default_amount)}，可再個別調整。</p>

        <div className="relative mb-3">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜尋會員或來賓姓名…"
              className="flex-grow outline-none text-sm"
            />
          </div>
          {results.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {results.map(r => (
                <button
                  key={r.key}
                  onClick={() => {
                    setPicked(prev => [...prev, r]);
                    setSearch('');
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-red-50 text-sm flex justify-between items-center"
                >
                  <span className="font-bold text-gray-800">{r.payee_name}</span>
                  <span className="text-[10px] text-gray-400">{r.member_id ? '會員' : '來賓'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mb-4">
          <input
            value={manualName}
            onChange={e => setManualName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && manualName.trim()) {
                e.preventDefault();
                setPicked(prev => [...prev, { key: `x-${manualName}-${Date.now()}`, payee_name: manualName.trim() }]);
                setManualName('');
              }
            }}
            placeholder="名單以外的人直接打名字，按 Enter"
            className="flex-grow border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {picked.length > 0 && (
          <div className="border rounded-lg p-3 mb-4 bg-gray-50/60 max-h-36 overflow-y-auto">
            <div className="flex flex-wrap gap-1.5">
              {picked.map(p => (
                <span key={p.key} className="inline-flex items-center gap-1 bg-white border rounded-full pl-2.5 pr-1 py-1 text-xs">
                  {p.payee_name}
                  <button onClick={() => setPicked(prev => prev.filter(x => x.key !== p.key))} className="text-gray-300 hover:text-red-500">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={saving} className="flex-1 border py-2.5 rounded-lg font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50">
            取消
          </button>
          <button
            onClick={save}
            disabled={saving || picked.length === 0}
            className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-bold hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Check size={16} /> {saving ? '加入中…' : `加入 ${picked.length} 人`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentBatchDetail;
