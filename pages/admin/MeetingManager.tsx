import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Gavel, QrCode, Save, Trash2, Copy, Check, Loader2, CalendarDays, MapPin,
  CircleAlert, X, FileDown, Link2,
} from 'lucide-react';
import {
  Activity, ActivityType, AttendanceRecord, AttendanceStatus, Member, Registration,
  MeetingActionItem, MeetingMinutes, GuestFollowUp, RenewalNote,
} from '../../types';
import { LEADERSHIP_MEETING_POSITIONS } from '../../constants';
import { CHAPTER_NAME } from '../../chapterConfig';
import { supabase } from '../../supabaseClient';
import CheckinQrPanel from '../../components/CheckinQrPanel';
import {
  AGENDA, buildMinutesText, exportMeetingPptx, GuestRow, MeetingReport, RenewalRow,
} from '../../lib/meetingReport';

// 執事會：簽到 + 照議程的會議記錄 + 待辦追蹤
//
// 議程沿用分會既有簡報的 8 段。能自動算的就自動算：
//   1 出缺席報告   → 對應例會的 attendance（P/A/L/M/S 與名單）
//   2/4/5 來賓追蹤 → guest_follow_ups 依來訪日期自動分成 今日／上週／之前
//   3 入會申請     → guest_follow_ups 裡 state = applied 的
//   6 續約狀況     → members 未來三個月到期者，狀況等欄位存 renewal_notes
//
// 會議本身是一筆 activities（type = 執事會），QR 報到與出席統計沿用現成的。

interface Props {
  canEdit: boolean;
  activities: Activity[];
  members: Member[];
  attendance: AttendanceRecord[];
  registrations: Registration[];
  currentUser?: { name?: string } | null;
  onUpdateAttendance: (actId: string, memId: string, status: AttendanceStatus) => void;
  onAddActivity: (a: Omit<Activity, 'id'>) => void;
  onRefreshAttendance?: () => void;
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; cls: string }[] = [
  { value: AttendanceStatus.PRESENT, label: '出席', cls: 'bg-green-600 text-white' },
  { value: AttendanceStatus.MEDICAL, label: '請假', cls: 'bg-amber-500 text-white' },
  { value: AttendanceStatus.ABSENT, label: '缺席', cls: 'bg-gray-400 text-white' },
];

const todayTpe = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
// 純日期字串不進 Date 物件，否則會被當 UTC 差一天
const fmtDate = (date: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!m) return date;
  const [, y, mo, d] = m;
  return `${+mo}/${+d}（${WEEKDAYS[new Date(+y, +mo - 1, +d).getDay()]}）`;
};
/** 從 YYYY-MM-DD 往後推 n 個月，回傳同樣格式 */
const addMonths = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const inputCls = 'w-full border rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500';
const areaCls = 'w-full border rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-500';

const Section: React.FC<{ num: number; title: string; children: React.ReactNode; hint?: string }> =
  ({ num, title, children, hint }) => (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center shrink-0">{num}</span>
        <h2 className="font-bold text-lg">{title}</h2>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  );

const GUEST_FIELDS: { key: keyof GuestFollowUp; label: string; w: string }[] = [
  { key: 'group_name', label: '組別', w: 'w-16' },
  { key: 'member_name', label: '會員', w: 'w-24' },
  { key: 'guest_name', label: '來賓', w: 'w-28' },
  { key: 'industry', label: '專業類別', w: 'flex-1 min-w-[140px]' },
  { key: 'interviewer', label: '訪談人', w: 'w-24' },
  { key: 'status_note', label: '狀況', w: 'flex-1 min-w-[160px]' },
];

const MeetingManager: React.FC<Props> = ({
  canEdit, activities, members, attendance, registrations, currentUser,
  onUpdateAttendance, onAddActivity, onRefreshAttendance,
}) => {
  const meetings = useMemo(
    () => activities.filter(a => a.type === ActivityType.LEADERSHIP_MEETING)
      .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [activities],
  );
  const regularMeetings = useMemo(
    () => activities.filter(a => a.type === ActivityType.REGULAR_MEETING)
      .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [activities],
  );

  const [selectedId, setSelectedId] = useState('');
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [items, setItems] = useState<MeetingActionItem[]>([]);
  const [openItems, setOpenItems] = useState<(MeetingActionItem & { meeting_date?: string })[]>([]);
  const [guests, setGuests] = useState<GuestFollowUp[]>([]);
  const [renewalNotes, setRenewalNotes] = useState<Record<number, RenewalNote>>({});
  const [notes, setNotes] = useState({
    attendance_note: '', application_note: '', guest_note: '',
    renewal_note: '', process_note: '', misc_note: '',
  });
  const [linkedId, setLinkedId] = useState<string>('');
  const [draft, setDraft] = useState({ content: '', owner_member_id: '', due_date: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const selected = meetings.find(m => String(m.id) === selectedId) ?? null;
  const linked = regularMeetings.find(a => String(a.id) === linkedId) ?? null;
  /** 對應例會的前一場，用來分「上週來賓」 */
  const prevRegular = useMemo(() => {
    if (!linked) return null;
    return regularMeetings.find(a => String(a.date) < String(linked.date)) ?? null;
  }, [linked, regularMeetings]);

  const expected = useMemo(
    () => members.filter(m => (m.status === undefined || m.status === 'active')
      && (m.positions ?? []).some(p => LEADERSHIP_MEETING_POSITIONS.includes(p)))
      .sort((a, b) => Number(a.member_no ?? 0) - Number(b.member_no ?? 0)),
    [members],
  );
  const activeMembers = useMemo(
    () => members.filter(m => m.status === undefined || m.status === 'active'), [members],
  );

  useEffect(() => { if (!selectedId && meetings.length > 0) setSelectedId(String(meetings[0].id)); }, [meetings, selectedId]);
  useEffect(() => { if (selectedId) load(selectedId); /* eslint-disable-next-line */ }, [selectedId]);

  async function load(activityId: string) {
    setLoading(true);
    try {
      const { data: mi } = await supabase.from('meeting_minutes').select('*').eq('activity_id', activityId).maybeSingle();
      setMinutes(mi ?? null);
      setNotes({
        attendance_note: mi?.attendance_note ?? '', application_note: mi?.application_note ?? '',
        guest_note: mi?.guest_note ?? '', renewal_note: mi?.renewal_note ?? '',
        process_note: mi?.process_note ?? '', misc_note: mi?.misc_note ?? '',
      });
      // 沒設定對應例會時，預設抓同一天的例會（執事會就在例會之後）
      const meetingDate = meetings.find(m => String(m.id) === activityId)?.date;
      const sameDay = regularMeetings.find(a => a.date === meetingDate);
      setLinkedId(String(mi?.regular_meeting_activity_id ?? sameDay?.id ?? ''));

      const [{ data: its }, { data: gs }, { data: rn }, { data: allMinutes }, { data: pending }] = await Promise.all([
        mi ? supabase.from('meeting_action_items').select('*').eq('minutes_id', mi.id).order('id')
           : Promise.resolve({ data: [] as any[] }),
        supabase.from('guest_follow_ups').select('*').order('visit_date', { ascending: false }).limit(300),
        supabase.from('renewal_notes').select('*'),
        supabase.from('meeting_minutes').select('id, activity_id'),
        supabase.from('meeting_action_items').select('*').eq('status', 'pending'),
      ]);
      setItems(its ?? []);
      setGuests(gs ?? []);
      setRenewalNotes(Object.fromEntries((rn ?? []).map((x: RenewalNote) => [x.member_id, x])));

      const byId = new Map((allMinutes ?? []).map((x: any) => [x.id, x.activity_id]));
      setOpenItems((pending ?? [])
        .filter((it: any) => String(byId.get(it.minutes_id)) !== String(activityId))
        .map((it: any) => ({ ...it, meeting_date: activities.find(a => String(a.id) === String(byId.get(it.minutes_id)))?.date })));
    } finally {
      setLoading(false);
    }
  }

  async function ensureMinutes(): Promise<number | null> {
    if (minutes) return minutes.id;
    const { data, error } = await supabase.from('meeting_minutes')
      .insert([{ activity_id: Number(selectedId), created_by: currentUser?.name ?? null }]).select().single();
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
      const { error } = await supabase.from('meeting_minutes')
        .update({ ...notes, regular_meeting_activity_id: linkedId ? Number(linkedId) : null }).eq('id', id);
      if (error) { alert('儲存失敗：' + error.message); return; }
      setSavedAt(new Date().toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' }));
    } finally { setSaving(false); }
  }

  // ===== 1 出缺席（自動） =====
  const attendanceSummary = useMemo(() => {
    if (!linked) return null;
    const recs = attendance.filter(r => String(r.activity_id) === String(linked.id));
    const nameOf = (memberId: string) => activeMembers.find(m => String(m.id) === String(memberId))?.name ?? `#${memberId}`;
    const pick = (st: AttendanceStatus) => recs.filter(r => r.status === st).map(r => nameOf(String(r.member_id)));
    const present = recs.filter(r => r.status === AttendanceStatus.PRESENT).length;
    const late = pick(AttendanceStatus.LATE), sub = pick(AttendanceStatus.SUBSTITUTE);
    return {
      meetingTitle: linked.title, meetingDate: linked.date,
      totalMembers: activeMembers.length,
      // 分會簡報的算法：人到了就算出席，含遲到與代理
      presentTotal: present + late.length + sub.length,
      present,
      absentNames: pick(AttendanceStatus.ABSENT), lateNames: late,
      medicalNames: pick(AttendanceStatus.MEDICAL), substituteNames: sub,
      unmarked: Math.max(0, activeMembers.length - recs.length),
      guestCount: registrations.filter(r => String(r.activityId) === String(linked.id)).length,
    };
  }, [linked, attendance, activeMembers, registrations]);

  // ===== 2/3/4/5 來賓分組 =====
  const todayGuests = useMemo(
    () => guests.filter(g => g.state !== 'dropped' && linked && g.visit_date === linked.date), [guests, linked]);
  const lastWeekGuests = useMemo(
    () => guests.filter(g => g.state !== 'dropped' && prevRegular && g.visit_date === prevRegular.date), [guests, prevRegular]);
  const earlierGuests = useMemo(
    () => guests.filter(g => g.state === 'tracking' && (!prevRegular || String(g.visit_date ?? '') < String(prevRegular.date))),
    [guests, prevRegular]);
  const applications = useMemo(() => guests.filter(g => g.state === 'applied'), [guests]);

  // ===== 6 續約（自動列出三個月內到期） =====
  const renewals: RenewalRow[] = useMemo(() => {
    const from = selected?.date ?? todayTpe();
    const to = addMonths(from, 3);
    return activeMembers
      .filter(m => m.end_date && m.end_date >= from && m.end_date <= to)
      .sort((a, b) => String(a.end_date).localeCompare(String(b.end_date)) || String(a.name).localeCompare(String(b.name), 'zh-Hant'))
      .map(m => {
        const note = renewalNotes[Number(m.id)];
        return {
          member_id: Number(m.id), name: m.name ?? '', end_date: m.end_date ?? '', group_name: m.group_name,
          status_note: note?.status_note ?? '', light: note?.light ?? null, committee: note?.committee ?? '',
          // 沒手動填就用系統算的：該會員引薦過的報名筆數
          guest_count: note?.guest_count ?? registrations.filter(r => (r.referrer ?? '').trim() === (m.name ?? '').trim()).length,
        };
      });
  }, [activeMembers, renewalNotes, registrations, selected]);

  async function saveGuest(id: number, patch: Partial<GuestFollowUp>) {
    setGuests(prev => prev.map(g => (g.id === id ? { ...g, ...patch } : g)));
    const { error } = await supabase.from('guest_follow_ups').update(patch).eq('id', id);
    if (error) alert('儲存來賓失敗：' + error.message);
  }
  async function addGuest(visitDate: string | null, state = 'tracking') {
    if (!canEdit) return;
    const { data, error } = await supabase.from('guest_follow_ups')
      .insert([{ guest_name: '（新來賓）', visit_date: visitDate, state }]).select().single();
    if (error) { alert('新增來賓失敗：' + error.message); return; }
    setGuests(prev => [data, ...prev]);
  }
  async function removeGuest(g: GuestFollowUp) {
    if (!canEdit || !confirm(`刪除來賓「${g.guest_name}」的追蹤紀錄？`)) return;
    const { error } = await supabase.from('guest_follow_ups').delete().eq('id', g.id);
    if (error) { alert('刪除失敗：' + error.message); return; }
    setGuests(prev => prev.filter(x => x.id !== g.id));
  }
  async function saveRenewal(memberId: number, patch: Partial<RenewalNote>) {
    const next = { ...(renewalNotes[memberId] ?? { member_id: memberId }), ...patch } as RenewalNote;
    setRenewalNotes(prev => ({ ...prev, [memberId]: next }));
    const { error } = await supabase.from('renewal_notes').upsert({ ...next, member_id: memberId });
    if (error) alert('儲存續約狀況失敗：' + error.message);
  }

  async function addItem() {
    if (!canEdit || !draft.content.trim()) return;
    const id = await ensureMinutes();
    if (!id) return;
    const owner = members.find(m => String(m.id) === draft.owner_member_id);
    const { data, error } = await supabase.from('meeting_action_items').insert([{
      minutes_id: id, content: draft.content.trim(),
      owner_member_id: owner ? Number(owner.id) : null, owner_name: owner?.name ?? null,
      due_date: draft.due_date || null,
    }]).select().single();
    if (error) { alert('新增待辦失敗：' + error.message); return; }
    setItems(prev => [...prev, data]);
    setDraft({ content: '', owner_member_id: '', due_date: '' });
  }
  async function toggleItem(item: MeetingActionItem) {
    if (!canEdit) return;
    const next = item.status === 'done' ? 'pending' : 'done';
    const { error } = await supabase.from('meeting_action_items')
      .update({ status: next, done_at: next === 'done' ? new Date().toISOString() : null }).eq('id', item.id);
    if (error) { alert('更新失敗：' + error.message); return; }
    setItems(prev => prev.map(i => (i.id === item.id ? { ...i, status: next as any } : i)));
    setOpenItems(prev => prev.filter(i => i.id !== item.id));
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
      title: (f.get('title') as string) || `執事會 ${f.get('date')}`,
      date: f.get('date') as string, time: f.get('time') as string, location: f.get('location') as string,
      type: ActivityType.LEADERSHIP_MEETING, price: 0, picture: '', description: '', status: 'active', is_internal: true,
    } as Omit<Activity, 'id'>);
    setShowNew(false);
  }

  const statusOf = (memberId: string | number) =>
    attendance.find(r => String(r.activity_id) === selectedId && String(r.member_id) === String(memberId))?.status;

  const toGuestRows = (rows: GuestFollowUp[]): GuestRow[] => rows.map(g => ({ ...g }));

  const report = (): MeetingReport => ({
    chapterName: CHAPTER_NAME,
    date: selected?.date ?? '', time: selected?.time, location: selected?.location,
    signIn: expected.map(m => ({ name: m.name ?? '', positions: m.positions ?? [], status: statusOf(m.id) })),
    attendance: attendanceSummary,
    attendanceNote: notes.attendance_note,
    todayGuests: toGuestRows(todayGuests), applications: toGuestRows(applications),
    lastWeekGuests: toGuestRows(lastWeekGuests), earlierGuests: toGuestRows(earlierGuests),
    applicationNote: notes.application_note, guestNote: notes.guest_note,
    renewals, renewalNote: notes.renewal_note,
    processNote: notes.process_note, miscNote: notes.misc_note,
    actionItems: items.map(i => ({ content: i.content, owner_name: i.owner_name, due_date: i.due_date, status: i.status })),
  });

  async function copyText() {
    try {
      await navigator.clipboard.writeText(buildMinutesText(report()));
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { prompt('請手動複製：', buildMinutesText(report())); }
  }
  async function exportPptx() {
    if (!selected) return;
    setExporting(true);
    try {
      await exportMeetingPptx(report(), `${CHAPTER_NAME}執事會${selected.date.replace(/-/g, '')}.pptx`);
    } catch (e: any) {
      alert('匯出失敗：' + (e?.message ?? String(e)));
    } finally { setExporting(false); }
  }

  // ===== 來賓表格 =====
  const GuestTable: React.FC<{ rows: GuestFollowUp[]; onAdd?: () => void; emptyHint: string }> =
    ({ rows, onAdd, emptyHint }) => (
      <div>
        <div className="hidden md:flex gap-2 px-1 pb-1 text-xs font-bold text-gray-400">
          {GUEST_FIELDS.map(f => <div key={String(f.key)} className={f.w}>{f.label}</div>)}
          <div className="w-16 text-center">狀態</div>
          {canEdit && <div className="w-8" />}
        </div>
        {rows.length === 0 && <p className="text-sm text-gray-400 py-3">{emptyHint}</p>}
        <div className="space-y-2">
          {rows.map(g => (
            <div key={g.id} className="flex flex-wrap md:flex-nowrap gap-2 items-center">
              {GUEST_FIELDS.map(f => (
                <input key={String(f.key)} className={`${inputCls} ${f.w}`} disabled={!canEdit}
                  defaultValue={(g[f.key] as string) ?? ''} placeholder={f.label}
                  onBlur={e => { if (e.target.value !== ((g[f.key] as string) ?? '')) saveGuest(g.id, { [f.key]: e.target.value } as any); }} />
              ))}
              <select className={`${inputCls} w-24 bg-white`} disabled={!canEdit} value={g.state}
                onChange={e => saveGuest(g.id, { state: e.target.value as any })}>
                <option value="tracking">追蹤中</option>
                <option value="applied">已填單</option>
                <option value="joined">已入會</option>
                <option value="dropped">不追蹤</option>
              </select>
              {canEdit && (
                <button onClick={() => removeGuest(g)} className="text-gray-300 hover:text-red-500 p-1 shrink-0"><Trash2 size={16} /></button>
              )}
            </div>
          ))}
        </div>
        {canEdit && onAdd && (
          <button onClick={onAdd} className="mt-3 text-sm font-bold text-red-600 flex items-center gap-1">
            <Plus size={16} /> 新增一位
          </button>
        )}
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Gavel size={24} className="text-slate-600" />執事會</h1>
          <p className="text-sm text-gray-400 mt-1">簽到、照議程的會議記錄與待辦追蹤。執事會是內部活動，不會出現在官網與行事曆。</p>
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
          <div className="lg:col-span-1 space-y-2">
            {meetings.map(m => {
              const isSel = String(m.id) === selectedId;
              const present = expected.filter(x => attendance.some(r =>
                String(r.activity_id) === String(m.id) && String(r.member_id) === String(x.id) && r.status === AttendanceStatus.PRESENT)).length;
              return (
                <button key={m.id} onClick={() => setSelectedId(String(m.id))}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${isSel ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-gray-100 hover:border-slate-300'}`}>
                  <p className="font-bold">{fmtDate(m.date)} {m.time}</p>
                  <p className={`text-xs mt-1 ${isSel ? 'text-slate-300' : 'text-gray-400'}`}>簽到 {present}/{expected.length}</p>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-3 space-y-5">
            {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-red-600" /></div>}

            {selected && !loading && (
              <>
                {/* 工具列 */}
                <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between flex-wrap gap-3">
                  <div className="text-sm text-gray-500 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 font-bold text-gray-900"><CalendarDays size={15} />{selected.date} {selected.time}</span>
                    {selected.location && <span className="flex items-center gap-1"><MapPin size={14} />{selected.location}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {savedAt && <span className="text-xs text-gray-400">已儲存 {savedAt}</span>}
                    <button onClick={copyText} className="border border-gray-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 hover:bg-gray-50">
                      {copied ? <><Check size={16} /> 已複製</> : <><Copy size={16} /> 複製全文</>}
                    </button>
                    <button onClick={exportPptx} disabled={exporting}
                      className="border border-gray-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 hover:bg-gray-50 disabled:opacity-50">
                      {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} 匯出簡報
                    </button>
                    {canEdit && (
                      <button onClick={saveMinutes} disabled={saving}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 儲存
                      </button>
                    )}
                  </div>
                </div>

                {/* 執事簽到 */}
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                    <h2 className="font-bold text-lg">執事簽到
                      <span className="ml-2 text-sm text-gray-400">
                        {expected.filter(m => statusOf(m.id) === AttendanceStatus.PRESENT).length}/{expected.length}
                      </span>
                    </h2>
                    <button onClick={() => setShowQr(v => !v)}
                      className="border border-gray-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 hover:bg-gray-50">
                      <QrCode size={16} /> {showQr ? '收起 QR' : 'QR 簽到'}
                    </button>
                  </div>
                  {showQr && (
                    <div className="mb-4">
                      <CheckinQrPanel activityId={Number(selected.id)} activityTitle={selected.title} onAttendanceRefresh={onRefreshAttendance} />
                    </div>
                  )}
                  {expected.length === 0 ? (
                    <p className="text-sm text-gray-400 py-3 text-center">
                      沒有人有執事會的職務。請先到「會員管理」設定職務（{LEADERSHIP_MEETING_POSITIONS.join('、')}）。
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 divide-y md:divide-y-0 divide-gray-50">
                      {expected.map(m => {
                        const st = statusOf(m.id);
                        return (
                          <div key={m.id} className="flex items-center justify-between py-2 gap-3">
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 truncate">{m.name}</p>
                              <p className="text-xs text-gray-400 truncate">{(m.positions ?? []).join('、')}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {STATUS_OPTIONS.map(opt => (
                                <button key={opt.value} disabled={!canEdit}
                                  onClick={() => onUpdateAttendance(String(selected.id), String(m.id), opt.value)}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40 ${st === opt.value ? opt.cls : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
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

                {/* 1 出缺席報告 */}
                <Section num={1} title={AGENDA[0]} hint="自動從例會出席紀錄產生">
                  <div className="flex items-center gap-2 mb-3 text-sm">
                    <Link2 size={15} className="text-gray-400" />
                    <span className="text-gray-500">對應例會</span>
                    <select value={linkedId} onChange={e => setLinkedId(e.target.value)} disabled={!canEdit}
                      className={`${inputCls} w-auto bg-white`}>
                      <option value="">（未選）</option>
                      {regularMeetings.slice(0, 20).map(a => <option key={a.id} value={String(a.id)}>{a.date} {a.title}</option>)}
                    </select>
                  </div>
                  {attendanceSummary ? (
                    <>
                      <div className="flex flex-wrap gap-4 mb-3">
                        <div><span className="text-xs text-gray-400 font-bold">P 出席</span>
                          <p className="text-2xl font-bold text-red-600">{attendanceSummary.presentTotal}</p></div>
                        <div><span className="text-xs text-gray-400 font-bold">會員人數</span>
                          <p className="text-2xl font-bold text-gray-700">{attendanceSummary.totalMembers}</p></div>
                        <div><span className="text-xs text-gray-400 font-bold">V 來賓</span>
                          <p className="text-2xl font-bold text-gray-700">{attendanceSummary.guestCount}</p></div>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        {([['A', '缺席', attendanceSummary.absentNames], ['L', '遲到/早退', attendanceSummary.lateNames],
                           ['M', '緊急醫療', attendanceSummary.medicalNames], ['S', '代理人', attendanceSummary.substituteNames]] as const)
                          .map(([k, label, names]) => (
                            <div key={k} className="flex gap-2">
                              <span className="font-bold text-red-600 w-4">{k}</span>
                              <span className="font-bold text-gray-600 w-20 shrink-0">{label} {names.length}</span>
                              <span className="text-gray-500">{names.join('、') || '—'}</span>
                            </div>
                          ))}
                      </div>
                      {attendanceSummary.unmarked > 0 && (
                        <p className="text-xs text-red-500 mt-2">還有 {attendanceSummary.unmarked} 位會員沒有點名紀錄，數字可能不完整。</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">P 出席＝點名的出席＋遲到＋代理（人到了就算到），與你們簡報的算法一致。</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">請先選對應的例會場次。</p>
                  )}
                  <textarea className={`${areaCls} mt-3 min-h-[60px]`} disabled={!canEdit} value={notes.attendance_note}
                    onChange={e => setNotes(n => ({ ...n, attendance_note: e.target.value }))} placeholder="補充說明（選填）" />
                </Section>

                {/* 2 今日來賓 */}
                <Section num={2} title={AGENDA[1]} hint={linked ? `來訪日 ${linked.date}` : '請先選對應例會'}>
                  <GuestTable rows={todayGuests} emptyHint="還沒有這場的來賓。"
                    onAdd={linked ? () => addGuest(linked.date) : undefined} />
                </Section>

                {/* 3 入會申請追蹤 */}
                <Section num={3} title={AGENDA[2]} hint="狀態設為「已填單」的來賓會自動列在這">
                  <GuestTable rows={applications} emptyHint="目前沒有填單申請的來賓。" />
                  <textarea className={`${areaCls} mt-3 min-h-[60px]`} disabled={!canEdit} value={notes.application_note}
                    onChange={e => setNotes(n => ({ ...n, application_note: e.target.value }))} placeholder="補充說明（選填）" />
                </Section>

                {/* 4 上週來賓 */}
                <Section num={4} title={AGENDA[3]} hint={prevRegular ? `來訪日 ${prevRegular.date}` : ''}>
                  <GuestTable rows={lastWeekGuests} emptyHint="上一場例會沒有來賓紀錄。"
                    onAdd={prevRegular ? () => addGuest(prevRegular.date) : undefined} />
                </Section>

                {/* 5 之前來賓 */}
                <Section num={5} title={AGENDA[4]} hint="更早且仍在追蹤中的">
                  <GuestTable rows={earlierGuests} emptyHint="沒有更早的追蹤中來賓。" onAdd={() => addGuest(null)} />
                  <textarea className={`${areaCls} mt-3 min-h-[60px]`} disabled={!canEdit} value={notes.guest_note}
                    onChange={e => setNotes(n => ({ ...n, guest_note: e.target.value }))} placeholder="來賓追蹤的補充說明（選填）" />
                </Section>

                {/* 6 續約 */}
                <Section num={6} title={AGENDA[5]} hint="自動列出三個月內到期的會員">
                  {renewals.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">未來三個月沒有會籍到期的會員。</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs font-bold text-gray-400 text-left">
                            <th className="pb-1 pr-2">姓名</th><th className="pb-1 pr-2">到期日</th>
                            <th className="pb-1 pr-2 w-44">狀況</th><th className="pb-1 pr-2 w-16">來賓</th>
                            <th className="pb-1 pr-2 w-16">燈號</th><th className="pb-1 pr-2">組別</th>
                            <th className="pb-1 w-28">組別委員</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {renewals.map(m => (
                            <tr key={m.member_id}>
                              <td className="py-1.5 pr-2 font-bold text-gray-900 whitespace-nowrap">{m.name}</td>
                              <td className="py-1.5 pr-2 text-gray-500 whitespace-nowrap">{m.end_date}</td>
                              <td className="py-1.5 pr-2">
                                <input className={inputCls} disabled={!canEdit} defaultValue={m.status_note ?? ''} placeholder="OK / 補來賓…"
                                  onBlur={e => e.target.value !== (m.status_note ?? '') && saveRenewal(m.member_id, { status_note: e.target.value })} />
                              </td>
                              <td className="py-1.5 pr-2">
                                <input type="number" className={inputCls} disabled={!canEdit} defaultValue={m.guest_count ?? ''}
                                  onBlur={e => saveRenewal(m.member_id, { guest_count: e.target.value === '' ? null : Number(e.target.value) })} />
                              </td>
                              <td className="py-1.5 pr-2">
                                <input type="number" className={inputCls} disabled={!canEdit} defaultValue={m.light ?? ''}
                                  onBlur={e => saveRenewal(m.member_id, { light: e.target.value === '' ? null : Number(e.target.value) })} />
                              </td>
                              <td className="py-1.5 pr-2 text-gray-500">{m.group_name ?? '—'}</td>
                              <td className="py-1.5">
                                <input className={inputCls} disabled={!canEdit} defaultValue={m.committee ?? ''}
                                  onBlur={e => e.target.value !== (m.committee ?? '') && saveRenewal(m.member_id, { committee: e.target.value })} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">來賓數預設是系統依「引薦人」算的，可以直接改成 PALMS 的數字。</p>
                  <textarea className={`${areaCls} mt-3 min-h-[60px]`} disabled={!canEdit} value={notes.renewal_note}
                    onChange={e => setNotes(n => ({ ...n, renewal_note: e.target.value }))} placeholder="補充說明（選填）" />
                </Section>

                {/* 7 / 8 */}
                <Section num={7} title={AGENDA[6]}>
                  <textarea className={`${areaCls} min-h-[110px]`} disabled={!canEdit} value={notes.process_note}
                    onChange={e => setNotes(n => ({ ...n, process_note: e.target.value }))} placeholder="一行一項" />
                </Section>
                <Section num={8} title={AGENDA[7]}>
                  <textarea className={`${areaCls} min-h-[110px]`} disabled={!canEdit} value={notes.misc_note}
                    onChange={e => setNotes(n => ({ ...n, misc_note: e.target.value }))} placeholder="一行一項" />
                </Section>

                {/* 待辦 */}
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h2 className="font-bold text-lg mb-3">
                    待辦事項
                    {items.length > 0 && <span className="ml-2 text-sm font-bold text-gray-400">{items.filter(i => i.status === 'done').length}/{items.length} 完成</span>}
                  </h2>
                  <div className="divide-y divide-gray-50">
                    {items.map(i => (
                      <div key={i.id} className="flex items-start gap-3 py-2.5">
                        <input type="checkbox" checked={i.status === 'done'} disabled={!canEdit} onChange={() => toggleItem(i)} className="w-4 h-4 mt-1 accent-green-600" />
                        <div className="flex-1 min-w-0">
                          <p className={i.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}>{i.content}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {i.owner_name || '未指定負責人'}
                            {i.due_date && <span className={i.status === 'pending' && i.due_date < todayTpe() ? 'text-red-500 font-bold' : ''}>
                              {' · '}{i.due_date} 前{i.status === 'pending' && i.due_date < todayTpe() ? '（已逾期）' : ''}
                            </span>}
                          </p>
                        </div>
                        {canEdit && <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={16} /></button>}
                      </div>
                    ))}
                    {items.length === 0 && <p className="text-sm text-gray-400 py-3">這次會議還沒有待辦事項。</p>}
                  </div>
                  {canEdit && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-[1fr_160px_150px_auto] gap-2">
                      <input value={draft.content} onChange={e => setDraft(d => ({ ...d, content: e.target.value }))} className={areaCls} placeholder="要做什麼…" />
                      <select value={draft.owner_member_id} onChange={e => setDraft(d => ({ ...d, owner_member_id: e.target.value }))} className={`${areaCls} bg-white`}>
                        <option value="">負責人</option>
                        {expected.map(m => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
                      </select>
                      <input type="date" value={draft.due_date} onChange={e => setDraft(d => ({ ...d, due_date: e.target.value }))} className={areaCls} />
                      <button onClick={addItem} disabled={!draft.content.trim()} className="bg-gray-900 text-white px-4 py-2.5 rounded-lg font-bold disabled:opacity-40">新增</button>
                    </div>
                  )}
                </div>

                {openItems.length > 0 && (
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                    <h2 className="font-bold text-lg flex items-center gap-2 text-amber-800">
                      <CircleAlert size={20} /> 前幾次還沒完成的待辦（{openItems.length}）
                    </h2>
                    <div className="mt-3 space-y-2">
                      {openItems.map(i => (
                        <div key={i.id} className="flex items-start gap-3">
                          <input type="checkbox" disabled={!canEdit} onChange={() => toggleItem(i)} className="w-4 h-4 mt-1 accent-green-600" />
                          <div>
                            <p className="text-gray-900">{i.content}</p>
                            <p className="text-xs text-amber-700 mt-0.5">
                              {i.meeting_date && `${i.meeting_date} 的會議`}{i.owner_name && ` · ${i.owner_name}`}{i.due_date && ` · ${i.due_date} 前`}
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

      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={createMeeting} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">新增執事會</h2>
              <button type="button" onClick={() => setShowNew(false)} className="text-gray-400 p-1"><X size={20} /></button>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">主題</label>
              <input name="title" className={areaCls} placeholder="留白就用「執事會 日期」" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">日期 *</label>
                <input name="date" type="date" required defaultValue={todayTpe()} className={areaCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">時間</label>
                <input name="time" type="time" defaultValue="08:30" className={areaCls} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">地點</label>
              <input name="location" className={areaCls} placeholder="例會同場地" />
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
