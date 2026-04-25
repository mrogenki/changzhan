import React, { useEffect, useMemo, useState } from 'react';
import { Search, Send, Users, MessageCircle, AlertCircle, CheckSquare, Square, ChevronDown, ChevronUp, Calendar, Phone, Mail, Building2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { AdminUser } from '../../types';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

type GuestSummary = {
  id: number;
  line_user_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  bound_at: string | null;
  attendance_count: number;
  last_attended_date: string | null;
  referrers: string;
};

type RegistrationRow = {
  id: number;
  activityId: number;
  name: string;
  phone: string;
  email: string;
  company: string | null;
  referrer: string | null;
  check_in_status: boolean | null;
  guest_id: number | null;
  created_at: string;
};

type ActivityLite = {
  id: number;
  title: string;
  date: string;
};

type MessageLog = {
  id: number;
  created_at: string;
  message_text: string;
  status: string;
  error_message: string | null;
  sent_by: string | null;
};

type AttendanceItem = {
  registrationId: number;
  activityId: number;
  activityTitle: string;
  activityDate: string;
  checkedIn: boolean;
};

interface GuestManagerProps {
  currentUser: AdminUser;
}

const GuestManager: React.FC<GuestManagerProps> = ({ currentUser }) => {
  const [guests, setGuests] = useState<GuestSummary[]>([]);
  const [unboundRegs, setUnboundRegs] = useState<RegistrationRow[]>([]); // 沒對應 guest_id 的 registrations
  const [activities, setActivities] = useState<ActivityLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'bound' | 'unbound'>('all');

  const [expandedGuestId, setExpandedGuestId] = useState<number | null>(null);
  const [expandedAttendance, setExpandedAttendance] = useState<AttendanceItem[]>([]);
  const [expandedMessages, setExpandedMessages] = useState<MessageLog[]>([]);
  const [expandedLoading, setExpandedLoading] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ sent: number; failed: number; skipped: number; errors: string[] } | null>(null);

  // 單發 modal
  const [singleSendGuest, setSingleSendGuest] = useState<GuestSummary | null>(null);
  const [singleMessage, setSingleMessage] = useState('');
  const [singleForce, setSingleForce] = useState(false);
  const [singleSending, setSingleSending] = useState(false);
  const [singleResult, setSingleResult] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [guestRes, regRes, actRes] = await Promise.all([
        supabase.from('guest_attendance_summary').select('*').order('attendance_count', { ascending: false }),
        supabase.from('registrations').select('*').is('guest_id', null).order('created_at', { ascending: false }),
        supabase.from('activities').select('id, title, date').order('date', { ascending: false }),
      ]);

      setGuests((guestRes.data ?? []) as GuestSummary[]);
      setUnboundRegs((regRes.data ?? []) as RegistrationRow[]);
      setActivities((actRes.data ?? []) as ActivityLite[]);
    } finally {
      setLoading(false);
    }
  }

  // 聯合清單(來賓 + 未綁 LINE 的 registrations 摺成 pseudo-guest 顯示)
  const unifiedRows = useMemo(() => {
    const boundRows = guests.map(g => ({
      kind: 'guest' as const,
      id: g.id,
      name: g.name,
      phone: g.phone,
      email: g.email,
      company: g.company,
      referrers: g.referrers,
      attendance_count: g.attendance_count,
      last_attended_date: g.last_attended_date,
      bound: !!g.line_user_id,
      line_user_id: g.line_user_id,
      raw: g,
    }));
    const unboundRows = unboundRegs.map(r => ({
      kind: 'registration' as const,
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      company: r.company,
      referrers: r.referrer ?? '',
      attendance_count: r.check_in_status ? 1 : 0,
      last_attended_date: null as string | null,
      bound: false,
      line_user_id: null as string | null,
      raw: r as any,
    }));
    return [...boundRows, ...unboundRows];
  }, [guests, unboundRegs]);

  const filteredRows = unifiedRows.filter(row => {
    if (filter === 'bound' && !row.bound) return false;
    if (filter === 'unbound' && row.bound) return false;
    if (!searchTerm) return true;
    const t = searchTerm.toLowerCase();
    return row.name.toLowerCase().includes(t)
      || row.phone.includes(t)
      || (row.company ?? '').toLowerCase().includes(t)
      || (row.email ?? '').toLowerCase().includes(t);
  });

  function toggleSelect(guestId: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(guestId)) next.delete(guestId);
      else next.add(guestId);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const selectableIds = filteredRows
      .filter(r => r.kind === 'guest' && r.bound)
      .map(r => r.id);
    const allSelected = selectableIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  }

async function expandGuest(guestId: number) {
    if (expandedGuestId === guestId) {
      setExpandedGuestId(null);
      setExpandedAttendance([]);
      setExpandedMessages([]);
      return;
    }
    setExpandedGuestId(guestId);
    setExpandedLoading(true);
    setExpandedAttendance([]);
    setExpandedMessages([]);
    try {
      const [regRes, msgRes] = await Promise.all([
        supabase.from('registrations').select('*').eq('guest_id', guestId).order('created_at', { ascending: false }),
        supabase
          .from('message_send_log')
          .select('*')
          .eq('recipient_kind', 'guest')
          .eq('recipient_id', String(guestId))
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      console.log('expandGuest msgRes:', msgRes);  // debug 用,確認後可移除

      const regs = (regRes.data ?? []) as RegistrationRow[];
      const items: AttendanceItem[] = regs.map(r => {
        const act = activities.find(a => a.id === r.activityId);
        return {
          registrationId: r.id,
          activityId: r.activityId,
          activityTitle: act?.title ?? '(活動已刪除)',
          activityDate: act?.date ?? '',
          checkedIn: !!r.check_in_status,
        };
      });
      setExpandedAttendance(items);
      setExpandedMessages((msgRes.data ?? []) as MessageLog[]);
    } finally {
      setExpandedLoading(false);
    }
  }

  // 單發訊息
  async function handleSingleSend() {
    if (!singleSendGuest || !singleMessage.trim()) return;
    setSingleSending(true);
    setSingleResult(null);
    try {
      const text = singleMessage.replace(/\{name\}/g, singleSendGuest.name);
      const { data, error } = await supabase.functions.invoke('send-line-message', {
        body: {
          recipients: [{
            kind: 'guest',
            id: singleSendGuest.id,
            lineUserId: singleSendGuest.line_user_id,
          }],
          messages: [{ type: 'text', text }],
          force: singleForce,
          sentBy: currentUser.name,
        },
      });
      if (error) {
        setSingleResult('呼叫失敗: ' + error.message);
        return;
      }
      const summary = data?.summary;
      if (summary?.sent === 1) {
        setSingleResult(`✅ 已成功送出給 ${singleSendGuest.name}`);
      } else if (summary?.skipped === 1) {
        setSingleResult(`⏭ 24 小時內已發送過相同訊息 (可勾選「強制重發」覆蓋)`);
      } else {
        setSingleResult(`❌ 發送失敗: ${data?.results?.[0]?.error ?? '未知錯誤'}`);
      }
    } catch (e: any) {
      setSingleResult('錯誤: ' + (e?.message ?? String(e)));
    } finally {
      setSingleSending(false);
    }
  }

  // 群發訊息
  async function handleBulkSend() {
    if (!bulkMessage.trim()) {
      alert('請輸入訊息內容');
      return;
    }
    if (selectedIds.size === 0) {
      alert('請至少勾選一位收件人');
      return;
    }
    if (!window.confirm(`確定要發送給 ${selectedIds.size} 位來賓嗎?`)) return;

    setBulkSending(true);
    setBulkResult(null);

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const errors: string[] = [];
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    // 為了支援 {name} per-recipient 替換,逐一發送
    const targetGuests = guests.filter(g => selectedIds.has(g.id) && g.line_user_id);

    for (const g of targetGuests) {
      const text = bulkMessage.replace(/\{name\}/g, g.name);
      try {
        const { data, error } = await supabase.functions.invoke('send-line-message', {
          body: {
            recipients: [{ kind: 'guest', id: g.id, lineUserId: g.line_user_id }],
            messages: [{ type: 'text', text }],
            sentBy: currentUser.name,
            batchId,
          },
        });
        if (error) {
          failed++;
          errors.push(`${g.name}: ${error.message}`);
          continue;
        }
        const r = data?.results?.[0];
        if (r?.ok) sent++;
        else if (r?.skipped) skipped++;
        else { failed++; errors.push(`${g.name}: ${r?.error ?? '未知'}`); }
      } catch (e: any) {
        failed++;
        errors.push(`${g.name}: ${e?.message ?? String(e)}`);
      }
    }

    setBulkResult({ sent, failed, skipped, errors });
    setBulkSending(false);
  }

  if (loading) {
    return <div className="p-10 text-center text-gray-400">載入來賓資料中...</div>;
  }

  const visibleSelectableCount = filteredRows.filter(r => r.kind === 'guest' && r.bound).length;
  const allVisibleSelected = visibleSelectableCount > 0 &&
    filteredRows.filter(r => r.kind === 'guest' && r.bound).every(r => selectedIds.has(r.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users size={24} className="text-blue-600" /> 來賓管理
          </h1>
          <p className="text-gray-500 text-sm">管理所有來賓資料、出席紀錄,並可發送 LINE 訊息</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setBulkOpen(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Send size={16} /> 群發訊息 ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border">
          <div className="text-xs text-gray-400 font-bold uppercase">總來賓</div>
          <div className="text-2xl font-bold text-gray-800">{unifiedRows.length}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
          <div className="text-xs text-green-600 font-bold uppercase">已綁 LINE</div>
          <div className="text-2xl font-bold text-green-700">{guests.filter(g => g.line_user_id).length}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
          <div className="text-xs text-yellow-600 font-bold uppercase">未綁 LINE</div>
          <div className="text-2xl font-bold text-yellow-700">{unboundRegs.length}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <div className="text-xs text-blue-600 font-bold uppercase">已勾選</div>
          <div className="text-2xl font-bold text-blue-700">{selectedIds.size}</div>
        </div>
      </div>

      {/* 篩選與搜尋 */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-4 rounded-xl border">
        <div className="flex items-center gap-2 flex-grow">
          <Search size={18} className="text-gray-400" />
          <input
            type="text"
            placeholder="搜尋姓名、電話、公司或 Email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-transparent outline-none w-full text-sm"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'bound', 'unbound'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? '全部' : f === 'bound' ? '已綁' : '未綁'}
            </button>
          ))}
        </div>
      </div>

      {/* 列表 */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr className="text-xs font-bold text-gray-400 uppercase">
                <th className="px-4 py-3 w-10">
                  {visibleSelectableCount > 0 && (
                    <button onClick={toggleSelectAllVisible} className="text-blue-500">
                      {allVisibleSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  )}
                </th>
                <th className="px-4 py-3">姓名 / 公司</th>
                <th className="px-4 py-3">聯絡資訊</th>
                <th className="px-4 py-3">引薦人</th>
                <th className="px-4 py-3 text-center">出席</th>
                <th className="px-4 py-3">最後參加</th>
                <th className="px-4 py-3">狀態</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRows.map(row => (
                <React.Fragment key={`${row.kind}-${row.id}`}>
                  <tr className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      {row.kind === 'guest' && row.bound ? (
                        <button onClick={() => toggleSelect(row.id)} className="text-blue-500">
                          {selectedIds.has(row.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      ) : (
                        <Square size={18} className="text-gray-200" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900">{row.name}</div>
                      <div className="text-xs text-gray-500">{row.company || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-mono text-gray-600">{row.phone}</div>
                      <div className="text-gray-400">{row.email || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{row.referrers || '—'}</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-700">{row.attendance_count}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{row.last_attended_date || '—'}</td>
                    <td className="px-4 py-3">
                      {row.bound ? (
                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                          已綁
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                          未綁定
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {row.kind === 'guest' && (
                          <button
                            onClick={() => expandGuest(row.id)}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                            title="展開詳情"
                          >
                            {expandedGuestId === row.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        )}
                        {row.kind === 'guest' && row.bound && (
                          <button
                            onClick={() => {
                              setSingleSendGuest(row.raw as GuestSummary);
                              setSingleMessage('');
                              setSingleForce(false);
                              setSingleResult(null);
                            }}
                            className="p-1.5 hover:bg-blue-100 rounded text-blue-600"
                            title="發送訊息"
                          >
                            <MessageCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* 展開區塊 */}
                  {expandedGuestId === row.id && row.kind === 'guest' && (
                    <tr>
                      <td colSpan={8} className="bg-blue-50/30 px-6 py-4">
                        {expandedLoading ? (
                          <p className="text-sm text-gray-400">載入中...</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="font-bold text-sm mb-2 flex items-center gap-1">
                                <Calendar size={14} /> 出席紀錄 ({expandedAttendance.length})
                              </h4>
                              {expandedAttendance.length === 0 ? (
                                <p className="text-xs text-gray-400">無紀錄</p>
                              ) : (
                                <ul className="space-y-1 max-h-60 overflow-y-auto">
                                  {expandedAttendance.map(a => (
                                    <li key={a.registrationId} className="text-xs flex justify-between bg-white px-3 py-2 rounded">
                                      <span>
                                        <span className="font-mono text-gray-400 mr-2">{a.activityDate}</span>
                                        {a.activityTitle}
                                      </span>
                                      <span className={`font-bold ${a.checkedIn ? 'text-green-600' : 'text-gray-400'}`}>
                                        {a.checkedIn ? '✅ 已報到' : '○ 未報到'}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <h4 className="font-bold text-sm mb-2 flex items-center gap-1">
                                <MessageCircle size={14} /> 訊息發送紀錄 ({expandedMessages.length})
                              </h4>
                              {expandedMessages.length === 0 ? (
                                <p className="text-xs text-gray-400">無紀錄</p>
                              ) : (
                                <ul className="space-y-1 max-h-60 overflow-y-auto">
                                  {expandedMessages.map(m => (
                                    <li key={m.id} className="text-xs bg-white px-3 py-2 rounded">
                                      <div className="flex justify-between mb-1">
                                        <span className="text-gray-400">{new Date(m.created_at).toLocaleString('zh-TW')}</span>
                                        <span className={`font-bold ${m.status === 'sent' ? 'text-green-600' : 'text-red-600'}`}>
                                          {m.status === 'sent' ? '✅ 已發' : '❌ 失敗'}
                                        </span>
                                      </div>
                                      <div className="text-gray-700 line-clamp-2">{m.message_text}</div>
                                      {m.error_message && (
                                        <div className="text-red-500 text-[10px] mt-1">{m.error_message}</div>
                                      )}
                                      {m.sent_by && <div className="text-gray-400 text-[10px] mt-1">by {m.sent_by}</div>}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {filteredRows.length === 0 && (
            <p className="p-10 text-center text-gray-400">沒有符合條件的來賓資料</p>
          )}
        </div>
      </div>

      {/* 單發 Modal */}
      {singleSendGuest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-1">發送 LINE 訊息</h3>
            <p className="text-xs text-gray-500 mb-4">收件人:{singleSendGuest.name}</p>
            <textarea
              rows={5}
              value={singleMessage}
              onChange={e => setSingleMessage(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
              placeholder="輸入訊息內容,可使用 {name} 變數..."
            />
            <div className="text-xs text-gray-400 mb-3">
              可用變數: <code className="bg-gray-100 px-1 rounded">{'{name}'}</code>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600 mb-4">
              <input
                type="checkbox"
                checked={singleForce}
                onChange={e => setSingleForce(e.target.checked)}
              />
              強制重發 (忽略 24 小時防呆)
            </label>
            {singleResult && (
              <div className="text-sm p-3 rounded-lg bg-gray-50 mb-3">{singleResult}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setSingleSendGuest(null); setSingleResult(null); }}
                className="flex-1 border py-2 rounded-lg"
              >
                關閉
              </button>
              <button
                onClick={handleSingleSend}
                disabled={singleSending || !singleMessage.trim()}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg disabled:opacity-50"
              >
                {singleSending ? '發送中...' : '發送'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 群發 Modal */}
      {bulkOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
              <Send size={18} /> 群發訊息
            </h3>
            <p className="text-xs text-gray-500 mb-4">收件人: {selectedIds.size} 位來賓</p>

            <textarea
              rows={6}
              value={bulkMessage}
              onChange={e => setBulkMessage(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
              placeholder="輸入訊息內容,可使用 {name} 變數..."
              disabled={bulkSending}
            />
            <div className="text-xs text-gray-400 mb-4">
              可用變數: <code className="bg-gray-100 px-1 rounded">{'{name}'}</code>
              <br />
              <AlertCircle size={10} className="inline" /> 24 小時內已收過相同訊息的來賓會被自動跳過
            </div>

            {bulkResult && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div>✅ 成功: <span className="font-bold text-green-600">{bulkResult.sent}</span></div>
                <div>⏭ 略過 (重複): <span className="font-bold text-yellow-600">{bulkResult.skipped}</span></div>
                <div>❌ 失敗: <span className="font-bold text-red-600">{bulkResult.failed}</span></div>
                {bulkResult.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer">查看失敗詳情</summary>
                    <ul className="text-xs text-red-500 mt-1 max-h-32 overflow-y-auto">
                      {bulkResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setBulkOpen(false); setBulkResult(null); setBulkMessage(''); }}
                className="flex-1 border py-2 rounded-lg"
                disabled={bulkSending}
              >
                {bulkResult ? '完成' : '取消'}
              </button>
              {!bulkResult && (
                <button
                  onClick={handleBulkSend}
                  disabled={bulkSending || !bulkMessage.trim()}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg disabled:opacity-50"
                >
                  {bulkSending ? '發送中...' : `發送給 ${selectedIds.size} 位`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestManager;
