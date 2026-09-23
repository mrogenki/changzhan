import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Gavel, QrCode, Save, Trash2, Copy, Check, Loader2, CalendarDays, MapPin, CircleAlert, X } from 'lucide-react';
import { Activity, ActivityType, AttendanceRecord, AttendanceStatus, Member, MeetingActionItem, MeetingMinutes } from '../../types';
import { LEADERSHIP_MEETING_POSITIONS } from '../../constants';
import { CHAPTER_NAME } from '../../chapterConfig';
import { supabase } from '../../supabaseClient';
import CheckinQrPanel from '../../components/CheckinQrPanel';

// 執事會：簽到 + 會議記錄 + 待辦追蹤
//
// 會議本身是一筆 activities（type = 執事會），所以 QR 報到與 attendance 出席統計
// 都是現成的。DB trigger 會把執事會釘成 is_internal，不會外洩到官網與行事曆。
//
// 應到名單＝職務在 LEADERSHIP_MEETING_POSITIONS 裡的在籍會員。

interface Props {
  canEdit: boolean;
  activities: Activity[];
  members: Member[];
  attendance: AttendanceRecord[];
  currentUser?: { name?: string } | null;
  onUpdateAttendance: (actId: string, memId: string, status: AttendanceStatus) => void;
  onAddActivity: (a: Omit<Activity, 'id'>) => void;
  onRefreshAttendance?: () => void;
}

// 執事會只記出席／請假／缺席，不套用例會那套遲到規則
const STATUS_OPTIONS: { value: AttendanceStatus; label: string; cls: string }[] = [
  { value: AttendanceStatus.PRESENT, label: '出席', cls: 'bg-green-600 text-white' },
  { value: AttendanceStatus.MEDICAL, label: '請假', cls: 'bg-amber-500 text-white' },
  { value: AttendanceStatus.ABSENT, label: '缺席', cls: 'bg-gray-400 text-white' },
];

const todayTpe = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
// activities.date 是純日期字串，new Date('2026-10-06') 會被當 UTC 而差一天
const fmtDate = (date: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!m) return date;
  const [, y, mo, d] = m;
  return `${+mo}/${+d}（${WEEKDAYS[new Date(+y, +mo - 1, +d).getDay()]}）`;
};

type ItemDraft = { content: string; owner_member_id: string; due_date: string };
const EMPTY_ITEM: ItemDraft = { content: '', owner_member_id: '', due_date: '' };

const MeetingManager: React.FC<Props> = ({
  canEdit, activities, members, attendance, currentUser, onUpdateAttendance, onAddActivity, onRefreshAttendance,
}) => {
  const meetings = useMemo(
    () => activities
      .filter(a => a.type === ActivityType.LEADERSHIP_MEETING)
      .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [activities],
  );

  const [selectedId, setSelectedId] = useState<string>('');
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [items, setItems] = useState<MeetingActionItem[]>([]);
  const [openItems, setOpenItems] = useState<(MeetingActionItem & { meeting_date?: string })[]>([]);
  const [content, setContent] = useState('');
  const [decisions, setDecisions] = useState('');
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_ITEM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string>('');
  const [showQr, setShowQr] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [copied, setCopied] = useState(false);

  const selected = meetings.find(m => String(m.id) === selectedId) ?? null;

  // 應到名單：有指定職務的在籍會員
  const expected = useMemo(
    () => members
      .filter(m => (m.status === undefined || m.status === 'active')
        && (m.positions ?? []).some(p => LEADERSHIP_MEETING_POSITIONS.includes(p)))
      .sort((a, b) => Number(a.member_no ?? 0) - Number(b.member_no ?? 0)),
    [members],
  );

  useEffect(() => {
    if (!selectedId && meetings.length > 0) setSelectedId(String(meetings[0].id));
  }, [meetings, selectedId]);

  useEffect(() => {
    if (selectedId) loadMinutes(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function loadMinutes(activityId: string) {
    setLoading(true);
    try {
      const { data: mi } = await supabase
        .from('meeting_minutes').select('*').eq('activity_id', activityId).maybeSingle();
      setMinutes(mi ?? null);
      setContent(mi?.content ?? '');
      setDecisions(mi?.decisions ?? '');
      if (mi) {
        const { data: its } = await supabase
          .from('meeting_action_items').select('*').eq('minutes_id', mi.id).order('id');
        setItems(its ?? []);
      } else {
        setItems([]);
      }
      // 其他場次還沒完成的待辦——會議記錄最有價值的部分就是這個。
      // 刻意分兩次查、在前端併起來，不用 PostgREST 的巢狀 embed：
      // 這兩張表都很小，而 embed 寫錯時會安靜地回空陣列，不容易發現。
      const { data: allMinutes } = await supabase.from('meeting_minutes').select('id, activity_id');
      const byId = new Map((allMinutes ?? []).map((x: any) => [x.id, x.activity_id]));
      const { data: pending } = await supabase
        .from('meeting_action_items').select('*').eq('status', 'pending');
      setOpenItems((pending ?? [])
        .filter((it: any) => String(byId.get(it.minutes_id)) !== String(activityId))
        .map((it: any) => ({
          ...it,
          meeting_date: activities.find(a => String(a.id) === String(byId.get(it.minutes_id)))?.date,
        })));
    } finally {
      setLoading(false);
    }
  }

  /** 記錄可能還不存在，先確保有一筆再回傳 id */
  async function ensureMinutes(): Promise<number | null> {
    if (minutes) return minutes.id;
    const { data, error } = await supabase
      .from('meeting_minutes')
      .insert([{ activity_id: Number(selectedId), created_by: currentUser?.name ?? null }])
      .select().single();
    if (error) { alert('建立會議記錄失敗：' + error.message); return null; }
    setMinutes(data);
    return data.id;
  }

  async function saveMinutes() {
    if (!canEdit || !selectedId) return;
    setSaving(true);
    try {
      const id = await ensureMinutes();
      if (!id) return;
      const { error } = await supabase
        .from('meeting_minutes').update({ content, decisions }).eq('id', id);
      if (error) { alert('儲存失敗：' + error.message); return; }
      setSavedAt(new Date().toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' }));
    } finally {
      setSaving(false);
    }
  }

  async function addItem() {
    if (!canEdit || !draft.content.trim()) return;
    const id = await ensureMinutes();
    if (!id) return;
    const owner = members.find(m => String(m.id) === draft.owner_member_id);
    const { data, error } = await supabase.from('meeting_action_items').insert([{
      minutes_id: id,
      content: draft.content.trim(),
      owner_member_id: owner ? Number(owner.id) : null,
      owner_name: owner?.name ?? null,
      due_date: draft.due_date || null,
    }]).select().single();
    if (error) { alert('新增待辦失敗：' + error.message); return; }
    setItems(prev => [...prev, data]);
    setDraft(EMPTY_ITEM);
  }

  async function toggleItem(item: MeetingActionItem) {
    if (!canEdit) return;
    const next = item.status === 'done' ? 'pending' : 'done';
    const { error } = await supabase.from('meeting_action_items')
      .update({ status: next, done_at: next === 'done' ? new Date().toISOString() : null })
      .eq('id', item.id);
    if (error) { alert('更新失敗：' + error.message); return; }
    setItems(prev => prev.map(i => (i.id === item.id ? { ...i, status: next as any } : i)));
    setOpenItems(prev => prev.filter(i => i.id !== item.id || next !== 'done'));
  }

  async function removeItem(item: MeetingActionItem) {
    if (!canEdit || !confirm(`刪除待辦「${item.content}」？`)) return;
    const { error } = await supabase.from('meeting_action_items').delete().eq('id', item.id);
    if (error) { alert('刪除失敗：' + error.message); return; }
    setItems(prev => prev.filter(i => i.id !== item.id));
  }

  function createMeeting(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onAddActivity({
      title: f.get('title') as string || `執事會 ${f.get('date')}`,
      date: f.get('date') as string,
      time: f.get('time') as string,
      location: f.get('location') as string,
      type: ActivityType.LEADERSHIP_MEETING,
      price: 0,
      picture: '',
      description: '',
      status: 'active',
      is_internal: true,
    } as Omit<Activity, 'id'>);
    setShowNew(false);
  }

  const statusOf = (memberId: string | number) =>
    attendance.find(r => String(r.activity_id) === selectedId && String(r.member_id) === String(memberId))?.status;

  const presentCount = expected.filter(m => statusOf(m.id) === AttendanceStatus.PRESENT).length;

  function minutesText() {
    if (!selected) return '';
    const present = expected.filter(m => statusOf(m.id) === AttendanceStatus.PRESENT).map(m => m.name);
    const leave = expected.filter(m => statusOf(m.id) === AttendanceStatus.MEDICAL).map(m => m.name);
    const absent = expected.filter(m => statusOf(m.id) === AttendanceStatus.ABSENT).map(m => m.name);
    const lines = [
      `【${CHAPTER_NAME}執事會記錄】`,
      `日期：${selected.date} ${selected.time ?? ''}`.trim(),
      selected.location ? `地點：${selected.location}` : '',
      '',
      `出席（${present.length}）：${present.join('、') || '—'}`,
      leave.length ? `請假：${leave.join('、')}` : '',
      absent.length ? `缺席：${absent.join('、')}` : '',
    ];
    if (content.trim()) lines.push('', '【討論事項】', content.trim());
    if (decisions.trim()) lines.push('', '【決議】', decisions.trim());
    if (items.length) {
      lines.push('', '【待辦事項】');
      items.forEach(i => lines.push(
        `${i.status === 'done' ? '✅' : '⬜'} ${i.content}` +
        `${i.owner_name ? `（${i.owner_name}` : ''}${i.due_date ? `${i.owner_name ? '，' : '（'}${i.due_date} 前` : ''}${i.owner_name || i.due_date ? '）' : ''}`,
      ));
    }
    return lines.filter(l => l !== '').join('\n');
  }

  async function copyMinutes() {
    try {
      await navigator.clipboard.writeText(minutesText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt('請手動複製：', minutesText());
    }
  }

  const inputCls = 'w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Gavel size={24} className="text-slate-600" />執事會</h1>
          <p className="text-sm text-gray-400 mt-1">
            簽到、會議記錄與待辦追蹤。執事會是內部活動，不會出現在官網與行事曆。
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setShowNew(true)}
            className="bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-red-700">
            <Plus size={18} /> 新增執事會
          </button>
        )}
      </div>

      {meetings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          還沒有執事會紀錄。按右上角「新增執事會」開始。
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 場次清單 */}
          <div className="lg:col-span-1 space-y-2">
            {meetings.map(m => {
              const isSel = String(m.id) === selectedId;
              const present = expected.filter(x =>
                attendance.some(r => String(r.activity_id) === String(m.id) && String(r.member_id) === String(x.id)
                  && r.status === AttendanceStatus.PRESENT)).length;
              return (
                <button key={m.id} onClick={() => setSelectedId(String(m.id))}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${isSel ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-gray-100 hover:border-slate-300'}`}>
                  <p className="font-bold">{fmtDate(m.date)} {m.time}</p>
                  <p className={`text-xs mt-1 ${isSel ? 'text-slate-300' : 'text-gray-400'}`}>
                    出席 {present}/{expected.length}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-3 space-y-6">
            {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-red-600" /></div>}

            {selected && !loading && (
              <>
                {/* 簽到 */}
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div>
                      <h2 className="font-bold text-lg">簽到</h2>
                      <p className="text-sm text-gray-400 flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1"><CalendarDays size={14} />{selected.date} {selected.time}</span>
                        {selected.location && <span className="flex items-center gap-1"><MapPin size={14} />{selected.location}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-500">出席 {presentCount}/{expected.length}</span>
                      <button onClick={() => setShowQr(v => !v)}
                        className="border border-gray-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 hover:bg-gray-50">
                        <QrCode size={16} /> {showQr ? '收起 QR' : 'QR 簽到'}
                      </button>
                    </div>
                  </div>

                  {showQr && (
                    <div className="mb-4">
                      <CheckinQrPanel activityId={Number(selected.id)} activityTitle={selected.title}
                        onAttendanceRefresh={onRefreshAttendance} />
                    </div>
                  )}

                  {expected.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">
                      沒有人有執事會的職務。請先到「會員管理」設定職務（{LEADERSHIP_MEETING_POSITIONS.join('、')}）。
                    </p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {expected.map(m => {
                        const st = statusOf(m.id);
                        return (
                          <div key={m.id} className="flex items-center justify-between py-2.5 gap-3">
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 truncate">{m.name}</p>
                              <p className="text-xs text-gray-400 truncate">{(m.positions ?? []).join('、')}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {STATUS_OPTIONS.map(opt => (
                                <button key={opt.value} disabled={!canEdit}
                                  onClick={() => onUpdateAttendance(String(selected.id), String(m.id), opt.value)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 ${
                                    st === opt.value ? opt.cls : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 會議記錄 */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-lg">會議記錄</h2>
                    <div className="flex items-center gap-2">
                      {savedAt && <span className="text-xs text-gray-400">已儲存 {savedAt}</span>}
                      <button onClick={copyMinutes}
                        className="border border-gray-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 hover:bg-gray-50">
                        {copied ? <><Check size={16} /> 已複製</> : <><Copy size={16} /> 複製全文</>}
                      </button>
                      {canEdit && (
                        <button onClick={saveMinutes} disabled={saving}
                          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
                          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 儲存
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">討論事項</label>
                    <textarea value={content} onChange={e => setContent(e.target.value)} disabled={!canEdit}
                      className={`${inputCls} min-h-[140px]`} placeholder="會議中討論了什麼…" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">決議</label>
                    <textarea value={decisions} onChange={e => setDecisions(e.target.value)} disabled={!canEdit}
                      className={`${inputCls} min-h-[100px]`} placeholder="做成什麼決定…" />
                  </div>
                </div>

                {/* 本次待辦 */}
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h2 className="font-bold text-lg mb-4">
                    待辦事項
                    {items.length > 0 && (
                      <span className="ml-2 text-sm font-bold text-gray-400">
                        {items.filter(i => i.status === 'done').length}/{items.length} 完成
                      </span>
                    )}
                  </h2>

                  <div className="divide-y divide-gray-50">
                    {items.map(i => (
                      <div key={i.id} className="flex items-start gap-3 py-2.5">
                        <input type="checkbox" checked={i.status === 'done'} disabled={!canEdit}
                          onChange={() => toggleItem(i)} className="w-4 h-4 mt-1 accent-green-600" />
                        <div className="flex-1 min-w-0">
                          <p className={`${i.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{i.content}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {i.owner_name || '未指定負責人'}
                            {i.due_date && <span className={i.status === 'pending' && i.due_date < todayTpe() ? 'text-red-500 font-bold' : ''}>
                              {' · '}{i.due_date} 前{i.status === 'pending' && i.due_date < todayTpe() ? '（已逾期）' : ''}
                            </span>}
                          </p>
                        </div>
                        {canEdit && (
                          <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                        )}
                      </div>
                    ))}
                    {items.length === 0 && <p className="text-sm text-gray-400 py-3">這次會議還沒有待辦事項。</p>}
                  </div>

                  {canEdit && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-[1fr_160px_150px_auto] gap-2">
                      <input value={draft.content} onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
                        className={inputCls} placeholder="要做什麼…" />
                      <select value={draft.owner_member_id} onChange={e => setDraft(d => ({ ...d, owner_member_id: e.target.value }))}
                        className={`${inputCls} bg-white`}>
                        <option value="">負責人</option>
                        {expected.map(m => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
                      </select>
                      <input type="date" value={draft.due_date} onChange={e => setDraft(d => ({ ...d, due_date: e.target.value }))}
                        className={inputCls} />
                      <button onClick={addItem} disabled={!draft.content.trim()}
                        className="bg-gray-900 text-white px-4 py-2.5 rounded-lg font-bold disabled:opacity-40">新增</button>
                    </div>
                  )}
                </div>

                {/* 其他場次未完成的待辦 */}
                {openItems.length > 0 && (
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                    <h2 className="font-bold text-lg flex items-center gap-2 text-amber-800">
                      <CircleAlert size={20} /> 前幾次還沒完成的待辦（{openItems.length}）
                    </h2>
                    <div className="mt-3 space-y-2">
                      {openItems.map(i => (
                        <div key={i.id} className="flex items-start gap-3">
                          <input type="checkbox" disabled={!canEdit} onChange={() => toggleItem(i)}
                            className="w-4 h-4 mt-1 accent-green-600" />
                          <div>
                            <p className="text-gray-900">{i.content}</p>
                            <p className="text-xs text-amber-700 mt-0.5">
                              {i.meeting_date && `${i.meeting_date} 的會議`}
                              {i.owner_name && ` · ${i.owner_name}`}
                              {i.due_date && ` · ${i.due_date} 前`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 新增執事會 */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={createMeeting} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">新增執事會</h2>
              <button type="button" onClick={() => setShowNew(false)} className="text-gray-400 p-1"><X size={20} /></button>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">主題</label>
              <input name="title" className={inputCls} placeholder="留白就用「執事會 日期」" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">日期 *</label>
                <input name="date" type="date" required defaultValue={todayTpe()} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">時間</label>
                <input name="time" type="time" defaultValue="08:30" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">地點</label>
              <input name="location" className={inputCls} placeholder="例會同場地" />
            </div>
            <p className="text-xs text-gray-400">執事會一律是內部活動，不會出現在官網與行事曆。</p>
            <button type="submit" className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700">建立</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default MeetingManager;
