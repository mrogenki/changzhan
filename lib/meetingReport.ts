// 執事會記錄 → 文字 / 簡報檔
//
// 議程照分會既有的簡報順序（8 段）。PPTX 由 pptxgenjs 在瀏覽器端產生，
// 是「相同結構的新版型」，不是原檔的像素級複製——原檔的版型要複製得靠
// 伺服器端拿 .pptx 當範本改 XML，瀏覽器做不到。

export type AttendanceSummary = {
  meetingTitle: string;
  meetingDate: string;
  totalMembers: number;
  /** 依分會簡報的算法：出席＝present + 遲到 + 代理（人到了就算到） */
  presentTotal: number;
  present: number;
  absentNames: string[];
  lateNames: string[];
  medicalNames: string[];
  substituteNames: string[];
  unmarked: number;
  guestCount: number;
};

export type GuestRow = {
  id?: number;
  group_name?: string | null;
  member_name?: string | null;
  guest_name: string;
  industry?: string | null;
  interviewer?: string | null;
  status_note?: string | null;
  visit_date?: string | null;
  state?: string;
};

export type RenewalRow = {
  member_id: number;
  name: string;
  end_date: string;
  group_name?: string | null;
  status_note?: string | null;
  light?: number | null;
  committee?: string | null;
  guest_count?: number | null;
};

export type ActionItemRow = {
  content: string;
  owner_name?: string | null;
  due_date?: string | null;
  status: string;
};

export type MeetingReport = {
  chapterName: string;
  date: string;
  time?: string;
  location?: string;
  signIn: { name: string; positions: string[]; status?: string }[];
  attendance: AttendanceSummary | null;
  attendanceNote?: string;
  todayGuests: GuestRow[];
  applications: GuestRow[];
  lastWeekGuests: GuestRow[];
  earlierGuests: GuestRow[];
  applicationNote?: string;
  guestNote?: string;
  renewals: RenewalRow[];
  renewalNote?: string;
  processNote?: string;
  miscNote?: string;
  actionItems: ActionItemRow[];
};

export const AGENDA = [
  '出缺席報告',
  '今日來賓訪談狀況',
  '入會申請追蹤',
  '上週來賓追蹤',
  '之前來賓追蹤',
  '363-會員續約狀況',
  '會議流程優化&建議事項',
  '臨時動議',
] as const;

const GUEST_HEADERS = ['組別', '會員', '來賓', '專業類別', '訪談人', '狀況'];
const guestCells = (g: GuestRow) =>
  [g.group_name ?? '', g.member_name ?? '', g.guest_name, g.industry ?? '', g.interviewer ?? '', g.status_note ?? ''];

const RENEWAL_HEADERS = ['姓名', '到期日', '狀況', '來賓', '燈號', '組別', '組別委員'];
const renewalCells = (r: RenewalRow) => [
  r.name, r.end_date ?? '', r.status_note ?? '',
  r.guest_count == null ? '' : String(r.guest_count),
  r.light == null ? '' : String(r.light),
  r.group_name ?? '', r.committee ?? '',
];

/** 簽到狀態 → 中文 */
const SIGN_IN_LABEL: Record<string, string> = { present: '出席', medical: '請假', absent: '缺席' };

// ============ 純文字版（貼 LINE 用） ============

export function buildMinutesText(r: MeetingReport): string {
  const L: string[] = [];
  L.push(`【${r.chapterName}執事會記錄】`);
  L.push(`日期：${r.date}${r.time ? ` ${r.time}` : ''}`);
  if (r.location) L.push(`地點：${r.location}`);

  const present = r.signIn.filter(s => s.status === 'present').map(s => s.name);
  const leave = r.signIn.filter(s => s.status === 'medical').map(s => s.name);
  const absent = r.signIn.filter(s => s.status === 'absent').map(s => s.name);
  L.push('', `執事簽到（${present.length}/${r.signIn.length}）：${present.join('、') || '—'}`);
  if (leave.length) L.push(`請假：${leave.join('、')}`);
  if (absent.length) L.push(`缺席：${absent.join('、')}`);

  const a = r.attendance;
  L.push('', `一、${AGENDA[0]}`);
  if (a) {
    L.push(`例會：${a.meetingDate}　會員人數 ${a.totalMembers} 人`);
    L.push(`P 出席 ${a.presentTotal} 人`);
    L.push(`A 缺席 ${a.absentNames.length} 人${a.absentNames.length ? `（${a.absentNames.join('、')}）` : ''}`);
    L.push(`L 遲到/早退 ${a.lateNames.length} 人${a.lateNames.length ? `（${a.lateNames.join('、')}）` : ''}`);
    L.push(`M 緊急醫療 ${a.medicalNames.length} 人${a.medicalNames.length ? `（${a.medicalNames.join('、')}）` : ''}`);
    L.push(`S 代理人 ${a.substituteNames.length} 人${a.substituteNames.length ? `（${a.substituteNames.join('、')}）` : ''}`);
    L.push(`V 來賓 ${a.guestCount} 人`);
    if (a.unmarked > 0) L.push(`（還有 ${a.unmarked} 位會員沒有點名紀錄）`);
  } else {
    L.push('（尚未對應例會場次）');
  }
  if (r.attendanceNote?.trim()) L.push(r.attendanceNote.trim());

  const guestBlock = (title: string, rows: GuestRow[]) => {
    L.push('', title);
    if (rows.length === 0) { L.push('（無）'); return; }
    rows.forEach(g => L.push(
      `・${[g.group_name, g.member_name].filter(Boolean).join(' ')}｜${g.guest_name}` +
      `${g.industry ? `／${g.industry}` : ''}${g.interviewer ? `｜訪談：${g.interviewer}` : ''}` +
      `${g.status_note ? `｜${g.status_note}` : ''}`,
    ));
  };

  guestBlock(`二、${AGENDA[1]}`, r.todayGuests);
  guestBlock(`三、${AGENDA[2]}`, r.applications);
  if (r.applicationNote?.trim()) L.push(r.applicationNote.trim());
  guestBlock(`四、${AGENDA[3]}`, r.lastWeekGuests);
  guestBlock(`五、${AGENDA[4]}`, r.earlierGuests);
  if (r.guestNote?.trim()) L.push(r.guestNote.trim());

  L.push('', `六、${AGENDA[5]}`);
  if (r.renewals.length === 0) L.push('（未來三個月無到期會員）');
  r.renewals.forEach(m => L.push(
    `・${m.name}｜${m.end_date}｜${m.status_note ?? '—'}` +
    `${m.guest_count != null ? `｜來賓 ${m.guest_count}` : ''}${m.light != null ? `｜燈號 ${m.light}` : ''}` +
    `${m.committee ? `｜${m.committee}` : ''}`,
  ));
  if (r.renewalNote?.trim()) L.push(r.renewalNote.trim());

  L.push('', `七、${AGENDA[6]}`, r.processNote?.trim() || '（無）');
  L.push('', `八、${AGENDA[7]}`, r.miscNote?.trim() || '（無）');

  if (r.actionItems.length) {
    L.push('', '【待辦事項】');
    r.actionItems.forEach(i => L.push(
      `${i.status === 'done' ? '✅' : '⬜'} ${i.content}` +
      `${i.owner_name ? `（${i.owner_name}${i.due_date ? `，${i.due_date} 前` : ''}）` : i.due_date ? `（${i.due_date} 前）` : ''}`,
    ));
  }
  return L.join('\n');
}

// ============ 簡報檔 ============

const NAVY = '1F2A44';
const RED = 'C8102E';
const GRAY = '6B7280';
const LIGHT = 'F3F4F6';

/** 表格太長要分頁，不然會超出投影片 */
const chunk = <T,>(rows: T[], size: number): T[][] => {
  if (rows.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
};

export async function exportMeetingPptx(r: MeetingReport, fileName: string) {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 英吋

  const slide = (title: string, index?: number) => {
    const s = pres.addSlide();
    s.addText(index ? `${index}. ${title}` : title, {
      x: 0.5, y: 0.35, w: 9, h: 0.6, fontSize: 30, bold: true, color: NAVY,
      fontFace: 'Calibri', isTextBox: true, margin: 0,
    });
    s.addText(`${r.chapterName}執事會　${r.date}`, {
      x: 0.5, y: 0.95, w: 9, h: 0.3, fontSize: 11, color: GRAY,
      fontFace: 'Calibri', isTextBox: true, margin: 0,
    });
    return s;
  };

  const tableOpts = {
    x: 0.5, y: 1.45, w: 9,
    fontSize: 12, fontFace: 'Calibri', color: '111827',
    border: { type: 'solid' as const, pt: 1, color: 'E5E7EB' },
    autoPage: false,
  };
  const headerRow = (cells: string[]) =>
    cells.map(t => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: NAVY } } }));

  // 1 出缺席報告
  const s1 = slide(AGENDA[0], 1);
  const a = r.attendance;
  if (a) {
    s1.addText([
      { text: 'P  出席　', options: { bold: true, color: RED } },
      { text: `${a.presentTotal} 人`, options: { bold: true, fontSize: 24 } },
      { text: `　／　會員人數 ${a.totalMembers} 人　／　V 來賓 ${a.guestCount} 人`, options: { color: GRAY, fontSize: 13 } },
    ], { x: 0.5, y: 1.4, w: 9, h: 0.5, fontSize: 16, fontFace: 'Calibri', isTextBox: true, margin: 0 });

    const rows: { k: string; label: string; names: string[] }[] = [
      { k: 'A', label: '缺席', names: a.absentNames },
      { k: 'L', label: '遲到/早退', names: a.lateNames },
      { k: 'M', label: '緊急醫療', names: a.medicalNames },
      { k: 'S', label: '代理人', names: a.substituteNames },
    ];
    s1.addTable([
      headerRow(['', '項目', '人數', '名單']),
      ...rows.map(x => [
        { text: x.k, options: { bold: true, color: RED, align: 'center' as const } },
        { text: x.label, options: { bold: true } },
        { text: `${x.names.length} 人`, options: { align: 'center' as const } },
        { text: x.names.join('、') || '—', options: { fontSize: 11 } },
      ]),
    ], { ...tableOpts, y: 2.1, colW: [0.5, 1.6, 1, 5.9], rowH: 0.45 });

    if (a.unmarked > 0) {
      s1.addText(`還有 ${a.unmarked} 位會員沒有點名紀錄`, {
        x: 0.5, y: 4.5, w: 9, h: 0.3, fontSize: 11, color: RED, fontFace: 'Calibri', isTextBox: true, margin: 0,
      });
    }
  } else {
    s1.addText('尚未對應例會場次', { x: 0.5, y: 2, w: 9, h: 0.5, fontSize: 16, color: GRAY, fontFace: 'Calibri', isTextBox: true });
  }
  if (r.attendanceNote?.trim()) {
    s1.addText(r.attendanceNote.trim(), {
      x: 0.5, y: 4.8, w: 9, h: 0.5, fontSize: 12, color: GRAY, fontFace: 'Calibri', isTextBox: true, margin: 0,
    });
  }

  // 2 / 4 / 5 來賓（表格，超過 7 列自動分頁）
  const guestSlides = (title: string, index: number, rows: GuestRow[]) => {
    const pages = chunk(rows, 7);
    if (pages.length === 0) {
      const s = slide(title, index);
      s.addText('（無）', { x: 0.5, y: 2, w: 9, h: 0.4, fontSize: 16, color: GRAY, fontFace: 'Calibri', isTextBox: true });
      return;
    }
    pages.forEach((page, i) => {
      const s = slide(pages.length > 1 ? `${title}（${i + 1}/${pages.length}）` : title, index);
      s.addTable([headerRow(GUEST_HEADERS), ...page.map(g => guestCells(g).map(t => ({ text: t })))],
        { ...tableOpts, colW: [0.7, 1.1, 1.3, 2.3, 1.3, 2.3], rowH: 0.45 });
    });
  };

  guestSlides(AGENDA[1], 2, r.todayGuests);

  // 3 入會申請追蹤
  const s3 = slide(AGENDA[2], 3);
  const appLines = r.applications.map(g =>
    `${g.member_name ? `${g.member_name}來賓：` : ''}${g.guest_name}${g.industry ? `／${g.industry}` : ''}${g.status_note ? `（${g.status_note}）` : ''}`);
  if (r.applicationNote?.trim()) appLines.push(...r.applicationNote.trim().split('\n').filter(Boolean));
  s3.addText(
    appLines.length
      ? appLines.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < appLines.length - 1 } }))
      : [{ text: '（無）', options: { color: GRAY } }],
    { x: 0.6, y: 1.5, w: 8.8, h: 3.5, fontSize: 15, fontFace: 'Calibri', color: '111827', isTextBox: true, paraSpaceAfter: 8 },
  );

  guestSlides(AGENDA[3], 4, r.lastWeekGuests);
  guestSlides(AGENDA[4], 5, r.earlierGuests);

  // 6 續約（每頁 8 列，與原簡報一致）
  const renewalPages = chunk(r.renewals, 8);
  if (renewalPages.length === 0) {
    const s = slide(AGENDA[5], 6);
    s.addText('未來三個月無到期會員', { x: 0.5, y: 2, w: 9, h: 0.4, fontSize: 16, color: GRAY, fontFace: 'Calibri', isTextBox: true });
  } else {
    renewalPages.forEach((page, i) => {
      const s = slide(renewalPages.length > 1 ? `${AGENDA[5]}（${i + 1}/${renewalPages.length}）` : AGENDA[5], 6);
      s.addTable([headerRow(RENEWAL_HEADERS), ...page.map(m => renewalCells(m).map((t, ci) => ({
        text: t, options: ci >= 3 && ci <= 5 ? { align: 'center' as const } : {},
      })))], { ...tableOpts, colW: [1.2, 1.3, 2.2, 0.7, 0.7, 0.7, 2.2], rowH: 0.42 });
    });
  }

  // 7 / 8 文字段
  const noteSlide = (title: string, index: number, text?: string) => {
    const s = slide(title, index);
    const lines = (text ?? '').split('\n').map(l => l.trim()).filter(Boolean);
    s.addText(
      lines.length
        ? lines.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < lines.length - 1 } }))
        : [{ text: '（無）', options: { color: GRAY } }],
      { x: 0.6, y: 1.5, w: 8.8, h: 3.5, fontSize: 15, fontFace: 'Calibri', color: '111827', isTextBox: true, paraSpaceAfter: 8 },
    );
  };
  noteSlide(AGENDA[6], 7, r.processNote);
  noteSlide(AGENDA[7], 8, r.miscNote);

  // 待辦（原簡報沒有這頁，有待辦才加）
  if (r.actionItems.length) {
    const s = slide('待辦事項');
    s.addTable([
      headerRow(['', '事項', '負責人', '期限']),
      ...r.actionItems.map(i => [
        { text: i.status === 'done' ? '✔' : '', options: { align: 'center' as const, color: '16A34A', bold: true } },
        { text: i.content },
        { text: i.owner_name ?? '' },
        { text: i.due_date ?? '' },
      ]),
    ], { ...tableOpts, colW: [0.5, 5.3, 1.6, 1.6], rowH: 0.42, fill: { color: LIGHT } });
  }

  await pres.writeFile({ fileName });
}
