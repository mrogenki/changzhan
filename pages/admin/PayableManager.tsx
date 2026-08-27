import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ReceiptText,
  Plus,
  Trash2,
  Check,
  X,
  Pencil,
  AlertTriangle,
  Ban,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Activity, AdminUser, PayableRecord, PayableStatus } from '../../types';

interface Props {
  canEdit: boolean;
  activities: Activity[];
  currentUser: AdminUser;
}

const CATEGORIES = ['活動費用', '會費', '場地費', '餐飲費', '行銷推廣', '其他'];

const money = (n: number) => `NT$ ${n.toLocaleString('zh-TW')}`;

const taipeiToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const STATUS_STYLE: Record<PayableStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
const STATUS_LABEL: Record<PayableStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  cancelled: '已取消',
};

const PayableManager: React.FC<Props> = ({ canEdit, activities, currentUser }) => {
  const [rows, setRows] = useState<PayableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'paid' | 'all'>('pending');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PayableRecord | null>(null);
  const [paying, setPaying] = useState<PayableRecord | null>(null);

  const today = taipeiToday();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('payable_records')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      setRows((data ?? []) as PayableRecord[]);
    } finally {
      setLoading(false);
    }
  }

  const pending = rows.filter(r => r.status === 'pending');
  const overdue = pending.filter(r => r.due_date && r.due_date < today);
  const visible = rows.filter(r => (filter === 'all' ? true : r.status === filter));

  const stat = useMemo(
    () => ({
      pendingTotal: pending.reduce((s, r) => s + r.amount, 0),
      overdueTotal: overdue.reduce((s, r) => s + r.amount, 0),
      paidThisMonth: rows
        .filter(r => r.status === 'paid' && (r.paid_at ?? '').slice(0, 7) === today.slice(0, 7))
        .reduce((s, r) => s + r.amount, 0),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows]
  );

  async function removeRow(r: PayableRecord) {
    const extra = r.finance_record_id
      ? '\n\n注意：這筆已經寫進收支管理，刪除應付紀錄不會刪掉流水帳那一筆。'
      : '';
    if (!window.confirm(`確定要刪除「${r.title}」嗎？${extra}`)) return;
    const { error } = await supabase.from('payable_records').delete().eq('id', r.id);
    if (error) alert('刪除失敗：' + error.message);
    else load();
  }

  async function cancelRow(r: PayableRecord) {
    if (!window.confirm(`把「${r.title}」標記為已取消嗎？（不會產生任何支出紀錄）`)) return;
    const { error } = await supabase
      .from('payable_records')
      .update({ status: 'cancelled' })
      .eq('id', r.id);
    if (error) alert('操作失敗：' + error.message);
    else load();
  }

  // 撤銷支付：把流水帳那筆一併刪掉，否則帳上會留下不該存在的支出
  async function undoPay(r: PayableRecord) {
    if (
      !window.confirm(
        `要撤銷「${r.title}」的支付嗎？\n\n${
          r.finance_record_id
            ? '收支管理中對應的那筆支出會一併刪除，'
            : ''
        }狀態會改回待支付。`
      )
    )
      return;
    if (r.finance_record_id) {
      const { error: delErr } = await supabase
        .from('finance_records')
        .delete()
        .eq('id', r.finance_record_id);
      if (delErr) {
        alert('刪除收支紀錄失敗：' + delErr.message);
        return;
      }
    }
    const { error } = await supabase
      .from('payable_records')
      .update({ status: 'pending', paid_at: null, paid_by: null, finance_record_id: null })
      .eq('id', r.id);
    if (error) alert('操作失敗：' + error.message);
    else load();
  }

  if (loading) return <div className="p-10 text-center text-gray-400">載入應付帳款中...</div>;

  return (
    <div className="space-y-6 text-gray-900">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ReceiptText size={24} className="text-red-600" /> 應付帳款
          </h1>
          <p className="text-gray-500 text-sm">
            記錄即將發生的支出。確認支付後才會寫進
            <Link to="/admin/finance" className="text-red-600 font-bold mx-1 hover:underline">
              收支管理
            </Link>
            的流水帳。
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl hover:bg-red-700 shadow-sm"
          >
            <Plus size={18} /> 新增應付帳款
          </button>
        )}
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
          <div className="text-xs text-amber-600 font-bold uppercase">待支付</div>
          <div className="text-2xl font-bold text-amber-700">{money(stat.pendingTotal)}</div>
          <p className="text-[11px] text-amber-600/80 mt-1">{pending.length} 筆</p>
        </div>
        <div className={`p-4 rounded-xl border ${overdue.length > 0 ? 'bg-red-50 border-red-100' : 'bg-white'}`}>
          <div className={`text-xs font-bold uppercase ${overdue.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            已逾期
          </div>
          <div className={`text-2xl font-bold ${overdue.length > 0 ? 'text-red-700' : 'text-gray-300'}`}>
            {money(stat.overdueTotal)}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">{overdue.length} 筆已過預計支付日</p>
        </div>
        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
          <div className="text-xs text-green-600 font-bold uppercase">本月已支付</div>
          <div className="text-2xl font-bold text-green-700">{money(stat.paidThisMonth)}</div>
        </div>
      </div>

      {/* 篩選 */}
      <div className="flex gap-1 bg-white p-2 rounded-xl border w-fit">
        {(
          [
            ['pending', `待支付（${pending.length}）`],
            ['paid', '已支付'],
            ['all', '全部'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filter === key ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 列表 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">項目</th>
                <th className="px-6 py-4">分類</th>
                <th className="px-6 py-4 text-right">金額</th>
                <th className="px-6 py-4">預計支付日</th>
                <th className="px-6 py-4">狀態</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.map(r => {
                const isOverdue = r.status === 'pending' && r.due_date && r.due_date < today;
                const activity = activities.find(a => String(a.id) === String(r.activity_id));
                return (
                  <tr key={r.id} className={`hover:bg-gray-50/50 ${isOverdue ? 'bg-red-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{r.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {activity && `活動：${activity.title}`}
                        {activity && r.note && ' · '}
                        {r.note}
                        {r.status === 'paid' && r.paid_at && (
                          <span className="text-green-600">
                            {(activity || r.note) && ' · '}
                            {String(r.paid_at).slice(0, 10)} 支付
                            {r.paid_by && `（${r.paid_by}）`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-600">
                        {r.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold whitespace-nowrap">
                      <span className={r.amount < 0 ? 'text-blue-600' : 'text-gray-800'}>
                        {money(r.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      {r.due_date ? (
                        <span className={isOverdue ? 'text-red-600 font-bold' : 'text-gray-500'}>
                          {isOverdue && <AlertTriangle size={12} className="inline mr-1 -mt-0.5" />}
                          {r.due_date}
                        </span>
                      ) : (
                        <span className="text-gray-300">未定</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${STATUS_STYLE[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {canEdit && r.status === 'pending' && (
                        <>
                          <button
                            onClick={() => setPaying(r)}
                            className="inline-flex items-center gap-1 bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-green-700 mr-1"
                          >
                            <Check size={14} /> 確認支付
                          </button>
                          <button
                            onClick={() => {
                              setEditing(r);
                              setFormOpen(true);
                            }}
                            className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg"
                            title="編輯"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => cancelRow(r)}
                            className="text-gray-400 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg"
                            title="標記為已取消"
                          >
                            <Ban size={16} />
                          </button>
                        </>
                      )}
                      {canEdit && r.status === 'paid' && (
                        <button
                          onClick={() => undoPay(r)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-red-600 px-2 py-1.5"
                          title="撤銷支付並刪除對應的流水帳"
                        >
                          <RotateCcw size={14} /> 撤銷支付
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => removeRow(r)}
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
          {visible.length === 0 && (
            <div className="p-10 text-center text-gray-400">
              {rows.length === 0 ? '還沒有應付帳款。點右上角「新增應付帳款」。' : '沒有符合條件的資料'}
            </div>
          )}
        </div>
      </div>

      {formOpen && (
        <PayableFormModal
          record={editing}
          activities={activities}
          currentUser={currentUser}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setFormOpen(false);
            setEditing(null);
            await load();
          }}
        />
      )}

      {paying && (
        <ConfirmPayModal
          record={paying}
          currentUser={currentUser}
          onClose={() => setPaying(null)}
          onPaid={async () => {
            setPaying(null);
            await load();
          }}
        />
      )}
    </div>
  );
};

/* ---------------- 新增／編輯 ---------------- */

const PayableFormModal: React.FC<{
  record: PayableRecord | null;
  activities: Activity[];
  currentUser: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}> = ({ record, activities, currentUser, onClose, onSaved }) => {
  const [saving, setSaving] = useState(false);
  const isEdit = !!record;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get('title') || '').trim();
    if (!title) return;

    const payload = {
      title,
      category: String(f.get('category') || '其他'),
      amount: Number(f.get('amount') || 0),
      // 空字串會讓 date 欄位炸掉，一律轉 null
      due_date: String(f.get('due_date') || '').trim() || null,
      activity_id: f.get('activity_id') ? Number(f.get('activity_id')) : null,
      note: String(f.get('note') || '').trim() || null,
    };

    setSaving(true);
    try {
      const { error } = isEdit
        ? await supabase.from('payable_records').update(payload).eq('id', record!.id)
        : await supabase
            .from('payable_records')
            .insert([{ ...payload, status: 'pending', created_by: currentUser.name }]);
      if (error) {
        alert((isEdit ? '儲存失敗：' : '新增失敗：') + error.message);
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
          <h2 className="text-xl font-bold">{isEdit ? '編輯應付帳款' : '新增應付帳款'}</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
            <X size={22} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">項目 *</label>
            <input
              name="title"
              required
              defaultValue={record?.title ?? ''}
              className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
              placeholder="例：成長協調員發出紅包"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">金額 *</label>
              <input
                name="amount"
                type="number"
                required
                defaultValue={record?.amount ?? ''}
                className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
                placeholder="1000"
              />
              <p className="text-[11px] text-gray-400 mt-1">沖銷／退回可填負數</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">分類</label>
              <select
                name="category"
                defaultValue={record?.category ?? '其他'}
                className="w-full border rounded-lg px-3 py-3 bg-white outline-none focus:ring-2 focus:ring-red-500"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">預計支付日</label>
              <input
                name="due_date"
                type="date"
                defaultValue={record?.due_date ?? ''}
                className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
              />
              <p className="text-[11px] text-gray-400 mt-1">留空 = 未定</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">關聯活動</label>
              <select
                name="activity_id"
                defaultValue={record?.activity_id ? String(record.activity_id) : ''}
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
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">備註</label>
            <textarea
              name="note"
              rows={2}
              defaultValue={record?.note ?? ''}
              className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
              placeholder="對象、緣由、預估依據…"
            />
          </div>
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
              {saving ? '儲存中…' : isEdit ? '儲存變更' : '新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ---------------- 確認支付 ---------------- */

const ConfirmPayModal: React.FC<{
  record: PayableRecord;
  currentUser: AdminUser;
  onClose: () => void;
  onPaid: () => void;
}> = ({ record, currentUser, onClose, onPaid }) => {
  const [payDate, setPayDate] = useState(taipeiToday());
  const [amount, setAmount] = useState(String(record.amount));
  const [saving, setSaving] = useState(false);

  const diff = Number(amount) !== record.amount;

  async function confirm() {
    setSaving(true);
    try {
      // 先寫流水帳，拿到 id 之後才回頭標記，避免標成已付卻沒有帳
      const { data: fr, error: frErr } = await supabase
        .from('finance_records')
        .insert([
          {
            type: 'expense',
            category: record.category,
            amount: Number(amount) || 0,
            date: payDate,
            description: record.title,
            activity_id: record.activity_id ?? null,
          },
        ])
        .select('id')
        .single();
      if (frErr || !fr) {
        alert('寫入收支管理失敗：' + (frErr?.message ?? ''));
        return;
      }

      const { error } = await supabase
        .from('payable_records')
        .update({
          status: 'paid',
          amount: Number(amount) || 0,
          paid_at: new Date(`${payDate}T00:00:00+08:00`).toISOString(),
          paid_by: currentUser.name,
          finance_record_id: fr.id,
        })
        .eq('id', record.id);
      if (error) {
        alert(
          `收支紀錄已建立，但應付帳款狀態更新失敗：${error.message}\n請手動確認，避免重複支付。`
        );
        return;
      }
      onPaid();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold">確認支付</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-5">
          確認後會在收支管理新增一筆支出，這筆應付帳款標記為已支付。
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <p className="font-bold text-gray-900">{record.title}</p>
          <p className="text-xs text-gray-500 mt-1">
            {record.category}
            {record.due_date && ` · 預計 ${record.due_date}`}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">實際支付日期</label>
            <input
              type="date"
              value={payDate}
              onChange={e => setPayDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">實際金額</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-green-500"
            />
            {diff && (
              <p className="text-[11px] text-amber-700 mt-1">
                與原本預估的 {money(record.amount)} 不同，應付紀錄會一併更新為實付金額。
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 border py-3 rounded-lg font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={confirm}
              disabled={saving || !payDate}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check size={16} /> {saving ? '處理中…' : `確認支付 ${money(Number(amount) || 0)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayableManager;
