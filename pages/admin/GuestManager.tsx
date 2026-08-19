import React, { useEffect, useMemo, useState } from 'react';
import { Search, Users, AlertCircle, ChevronDown, ChevronUp, Calendar, StickyNote } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

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
  notes: string | null;
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
  notes: string | null;
};

type ActivityLite = {
  id: number;
  title: string;
  date: string;
};

type AttendanceItem = {
  registrationId: number;
  activityId: number;
  activityTitle: string;
  activityDate: string;
  checkedIn: boolean;
};

// 備註編輯對象：清單同時有 guests 與未綁定的 registrations，要記住寫回哪張表
type NoteTarget = {
  kind: 'guest' | 'registration';
  id: number;
  name: string;
  notes: string;
};

const GuestManager: React.FC = () => {
  const [guests, setGuests] = useState<GuestSummary[]>([]);
  const [unboundRegs, setUnboundRegs] = useState<RegistrationRow[]>([]); // 沒對應 guest_id 的 registrations
  const [activities, setActivities] = useState<ActivityLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'bound' | 'unbound'>('all');

  const [expandedGuestId, setExpandedGuestId] = useState<number | null>(null);
  const [expandedAttendance, setExpandedAttendance] = useState<AttendanceItem[]>([]);
  const [expandedLoading, setExpandedLoading] = useState(false);

  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

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
      notes: g.notes ?? '',
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
      notes: r.notes ?? '',
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
      || (row.email ?? '').toLowerCase().includes(t)
      || row.notes.toLowerCase().includes(t);
  });

  const notedCount = unifiedRows.filter(r => r.notes.trim()).length;

  async function expandGuest(guestId: number) {
    if (expandedGuestId === guestId) {
      setExpandedGuestId(null);
      setExpandedAttendance([]);
      return;
    }
    setExpandedGuestId(guestId);
    setExpandedLoading(true);
    setExpandedAttendance([]);
    try {
      const { data } = await supabase
        .from('registrations')
        .select('*')
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false });

      const regs = (data ?? []) as RegistrationRow[];
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
    } finally {
      setExpandedLoading(false);
    }
  }

  function openNoteEditor(row: { kind: 'guest' | 'registration'; id: number; name: string; notes: string }) {
    setNoteTarget({ kind: row.kind, id: row.id, name: row.name, notes: row.notes });
    setNoteDraft(row.notes);
    setNoteError(null);
  }

  async function handleSaveNote() {
    if (!noteTarget) return;
    setNoteSaving(true);
    setNoteError(null);
    const value = noteDraft.trim() || null;
    const table = noteTarget.kind === 'guest' ? 'guests' : 'registrations';
    const { error } = await supabase.from(table).update({ notes: value }).eq('id', noteTarget.id);
    setNoteSaving(false);
    if (error) {
      setNoteError('儲存失敗：' + error.message);
      return;
    }
    // 只更新記憶體中的該筆，不必整頁重抓
    if (noteTarget.kind === 'guest') {
      setGuests(prev => prev.map(g => (g.id === noteTarget.id ? { ...g, notes: value } : g)));
    } else {
      setUnboundRegs(prev => prev.map(r => (r.id === noteTarget.id ? { ...r, notes: value } : r)));
    }
    setNoteTarget(null);
  }

  if (loading) {
    return <div className="p-10 text-center text-gray-400">載入來賓資料中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users size={24} className="text-blue-600" /> 來賓管理
          </h1>
          <p className="text-gray-500 text-sm">管理所有來賓資料、出席紀錄與備註</p>
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
          <div className="text-xs text-blue-600 font-bold uppercase">已備註</div>
          <div className="text-2xl font-bold text-blue-700">{notedCount}</div>
        </div>
      </div>

      {/* 篩選與搜尋 */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-4 rounded-xl border">
        <div className="flex items-center gap-2 flex-grow">
          <Search size={18} className="text-gray-400" />
          <input
            type="text"
            placeholder="搜尋姓名、電話、公司、Email 或備註..."
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
                <th className="px-4 py-3">姓名 / 公司</th>
                <th className="px-4 py-3">聯絡資訊</th>
                <th className="px-4 py-3">引薦人</th>
                <th className="px-4 py-3 text-center">出席</th>
                <th className="px-4 py-3">最後參加</th>
                <th className="px-4 py-3">狀態</th>
                <th className="px-4 py-3 min-w-[200px]">備註</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRows.map(row => (
                <React.Fragment key={`${row.kind}-${row.id}`}>
                  <tr className="hover:bg-gray-50/50">
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
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openNoteEditor(row)}
                        className="text-left w-full group"
                        title="編輯備註"
                      >
                        {row.notes ? (
                          <span className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-3 group-hover:text-blue-600">
                            {row.notes}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 group-hover:text-blue-600 flex items-center gap-1">
                            <StickyNote size={13} /> 新增備註
                          </span>
                        )}
                      </button>
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

      {/* 備註編輯 Modal */}
      {noteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
              <StickyNote size={18} className="text-blue-600" /> 來賓備註
            </h3>
            <p className="text-xs text-gray-500 mb-4">{noteTarget.name}</p>
            <textarea
              rows={6}
              autoFocus
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="記錄來賓狀態，例如：已邀約 9/10 例會、有意願入會、暫不考慮…"
            />
            {noteError && (
              <div className="text-xs text-red-600 mb-3 flex items-start gap-1">
                <AlertCircle size={12} className="mt-0.5 shrink-0" /> {noteError}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setNoteTarget(null)}
                disabled={noteSaving}
                className="flex-1 border py-2 rounded-lg font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveNote}
                disabled={noteSaving}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {noteSaving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestManager;
