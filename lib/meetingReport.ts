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
  mentor?: string | null;
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

const RENEWAL_HEADERS = ['姓名', '到期日', '狀況', '來賓', '燈號', '組別', '組別執事', '組別導師'];
const renewalCells = (r: RenewalRow) => [
  r.name, r.end_date ?? '', r.status_note ?? '',
  r.guest_count == null ? '' : String(r.guest_count),
  r.light == null ? '' : String(r.light),
  r.group_name ?? '', r.committee ?? '', r.mentor ?? '',
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
  // 完全沒有紀錄的人＝還沒點名，和「缺席」是兩回事。原本這裡沒列，等於貼出去的
  // 記錄會讓沒點到的人憑空消失（人數也對不起來）。
  const unmarked = r.signIn.filter(s => !s.status).map(s => s.name);
  const rate = r.signIn.length ? Math.round(present.length / r.signIn.length * 100) : 0;
  L.push('', `執事簽到　應到 ${r.signIn.length}／出席 ${present.length}（${rate}%）`
    + `／請假 ${leave.length}／缺席 ${absent.length}`
    + (unmarked.length ? `／未點名 ${unmarked.length}` : ''));
  L.push(`出席：${present.join('、') || '—'}`);
  if (leave.length) L.push(`請假：${leave.join('、')}`);
  if (absent.length) L.push(`缺席：${absent.join('、')}`);
  if (unmarked.length) L.push(`未點名：${unmarked.join('、')}`);

  const a = r.attendance;
  L.push('', `一、${AGENDA[0]}`);
  if (a) {
    const rate = a.totalMembers ? Math.round(a.presentTotal / a.totalMembers * 100) : 0;
    L.push(`例會：${a.meetingDate}　會員人數 ${a.totalMembers} 人`);
    L.push(`P 出席 ${a.presentTotal} 人（出席率 ${rate}%）`);
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

// ============ 簡報風格 ============
//
// 版型結構是共用的，風格只換顏色與標題的裝飾——這樣新增一種風格不會動到版面邏輯，
// 也不會把「名單疊到表格上」那類位置計算的坑重新引入一次。
export type ReportThemeKey = 'classic' | 'bni' | 'dark' | 'section';

type Theme = {
  label: string;
  desc: string;
  bg?: string;          // 投影片底色，不給就是白底
  title: string;        // 標題文字
  sub: string;          // 副標（分會名／日期）
  accent: string;       // 強調色（大數字、A/L/M/S 代號）
  head: string;         // 表頭底色
  headText: string;
  text: string;         // 內文
  border: string;       // 表格框線
  zebra: string;        // 合計列／待辦表的底色
  bar?: boolean;        // 標題左邊畫一條色塊
  palette?: string[];   // 有給的話，每一段議程輪替不同主色
};

export const REPORT_THEMES: Record<ReportThemeKey, Theme> = {
  classic: {
    label: '簡潔藍', desc: '目前的樣式：白底、深藍標題、細灰線',
    title: '1F2A44', sub: '6B7280', accent: 'C8102E',
    head: '1F2A44', headText: 'FFFFFF', text: '111827',
    border: 'E5E7EB', zebra: 'F3F4F6',
  },
  bni: {
    label: 'BNI 紅', desc: '分會識別色：標題左側紅色粗條、紅色表頭',
    title: '1A1A1A', sub: '8A8A8A', accent: 'C8102E',
    head: 'C8102E', headText: 'FFFFFF', text: '1A1A1A',
    border: 'E3D6D8', zebra: 'FBF0F1', bar: true,
  },
  dark: {
    label: '深色投影', desc: '深藍底白字，暗房投影對比最好',
    bg: '12192B',
    title: 'FFFFFF', sub: '94A3B8', accent: 'FF6B7F',
    head: '2B3A57', headText: 'FFFFFF', text: 'E5E7EB',
    border: '3A4A69', zebra: '1C273D', bar: true,
  },
  section: {
    label: '彩色分區', desc: '每段議程一個主色，翻頁有節奏感',
    title: '1F2A44', sub: '6B7280', accent: 'C8102E',
    head: '1F2A44', headText: 'FFFFFF', text: '111827',
    border: 'E5E7EB', zebra: 'F3F4F6', bar: true,
    // 簽到、出缺席、來賓、入會、上週、之前、續約、流程、臨時動議、待辦
    palette: ['0F766E', '1D4ED8', 'B45309', 'B45309', 'B45309', 'B45309',
              '15803D', '6D28D9', '6D28D9', '334155'],
  },
};

// 簡報的顏色一律走 REPORT_THEMES，這裡不再留全域色票（留著容易又寫死一個）

/** 表格太長要分頁，不然會超出投影片 */
const chunk = <T,>(rows: T[], size: number): T[][] => {
  if (rows.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
};

export async function exportMeetingPptx(
  r: MeetingReport, fileName: string, themeKey: ReportThemeKey = 'classic',
) {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 英吋

  const T = REPORT_THEMES[themeKey] ?? REPORT_THEMES.classic;
  // 「彩色分區」每段換色，其餘風格整份同一色。headerRow 不知道自己在哪一張，
  // 所以由 slide() 更新這個值。
  let accent = T.palette?.[0] ?? T.head;
  let slideSeq = 0;

  const slide = (title: string, index?: number) => {
    const s = pres.addSlide();
    if (T.bg) s.background = { color: T.bg };
    accent = T.palette?.[slideSeq % T.palette.length] ?? T.head;
    slideSeq += 1;

    const titleX = T.bar ? 0.72 : 0.5;
    if (T.bar) {
      s.addShape(pres.ShapeType.rect, {
        x: 0.5, y: 0.37, w: 0.1, h: 0.62, fill: { color: accent },
      });
    }
    s.addText(index ? `${index}. ${title}` : title, {
      x: titleX, y: 0.35, w: 9.5 - titleX, h: 0.6, fontSize: 30, bold: true,
      color: T.palette ? accent : T.title,
      fontFace: 'Calibri', isTextBox: true, margin: 0,
    });
    s.addText(`${r.chapterName}執事會　${r.date}`, {
      x: titleX, y: 0.95, w: 9.5 - titleX, h: 0.32, fontSize: 13, color: T.sub,
      fontFace: 'Calibri', isTextBox: true, margin: 0,
    });
    return s;
  };

  // 執事簽到那張的表格位置／列高——名單要接在表格下面，所以兩邊都得用同一組值
  const SIGNIN_TABLE_Y = 1.95;
  const SIGNIN_ROW_H = 0.44;

  const tableOpts = {
    x: 0.5, y: 1.45, w: 9,
    fontSize: 14, fontFace: 'Calibri', color: T.text,
    border: { type: 'solid' as const, pt: 1, color: T.border },
    autoPage: false,
  };
  const headerRow = (cells: string[]) =>
    cells.map(t => ({ text: t, options: { bold: true, color: T.headText, fill: { color: accent } } }));

  // 執事簽到（放在議程之前，與「複製全文」的順序一致）
  //
  // ⚠️ 分類的優先順序要跟畫面上的 signInGroups 一致：先比主席／副主席／秘財，
  //    再執事、再導師。有人同時掛兩個職務時兩邊才不會算到不同類去。
  const signInCategory = (positions: string[]) =>
    positions.some(x => ['主席', '副主席', '秘財'].includes(x)) ? '主席/副主席/秘財'
      : positions.includes('執事') ? '執事'
      : positions.includes('導師') ? '導師' : '其他職務';

  if (r.signIn.length > 0) {
    const s0 = slide('執事簽到');
    const pick = (rows: typeof r.signIn, st?: string) =>
      st ? rows.filter(x => x.status === st) : rows.filter(x => !x.status);
    const names = (rows: typeof r.signIn) => rows.map(x => x.name);

    const presentAll = pick(r.signIn, 'present');
    const rate = Math.round(presentAll.length / r.signIn.length * 100);
    s0.addText([
      { text: '出席　', options: { bold: true, color: T.accent } },
      { text: `${presentAll.length} 人`, options: { bold: true, fontSize: 28 } },
      { text: `　／　應到 ${r.signIn.length} 人　／　出席率 ${rate}%`, options: { color: T.sub, fontSize: 15 } },
    ], { x: 0.5, y: 1.33, w: 9, h: 0.5, fontSize: 18, fontFace: 'Calibri', isTextBox: true, margin: 0 });

    // 只列實際有人的分類，免得印出一排 0
    const cats = ['執事', '導師', '主席/副主席/秘財', '其他職務']
      .map(c => ({ c, rows: r.signIn.filter(x => signInCategory(x.positions) === c) }))
      .filter(x => x.rows.length > 0);
    const countsOf = (rows: typeof r.signIn) => [
      String(rows.length), String(pick(rows, 'present').length),
      String(pick(rows, 'medical').length), String(pick(rows, 'absent').length),
      String(pick(rows).length),
    ];
    s0.addTable([
      headerRow(['類別', '應到', '出席', '請假', '缺席', '未點名']),
      ...cats.map(x => [
        { text: x.c, options: { bold: true } },
        ...countsOf(x.rows).map(t => ({ text: t, options: { align: 'center' as const } })),
      ]),
      [
        { text: '合計', options: { bold: true, fill: { color: T.zebra } } },
        ...countsOf(r.signIn).map(t => ({
          text: t, options: { align: 'center' as const, bold: true, fill: { color: T.zebra } },
        })),
      ],
    ], { ...tableOpts, y: SIGNIN_TABLE_Y, colW: [2.4, 1.1, 1.1, 1.1, 1.1, 2.2], rowH: SIGNIN_ROW_H });

    // 請假／缺席／未點名各列一行名單——出席的人太多，列出來反而看不到重點
    const lines: { label: string; rows: typeof r.signIn; color: string }[] = [
      { label: '請假', rows: pick(r.signIn, 'medical'), color: T.sub },
      { label: '缺席', rows: pick(r.signIn, 'absent'), color: T.sub },
      { label: '未點名', rows: pick(r.signIn), color: T.accent },
    ].filter(x => x.rows.length > 0);
    // ⚠️ 表格底部要用「列數 × 列高」自己算，**而且列數要含標題列與合計列**。
    //    原本只算了分類列，名單就直接疊在合計那一行上（實際印出來才看到）。
    //    pptxgenjs 在 XML 寫的表格高度是名目值、不等於實際佔位，量 XML 驗不出這個錯。
    const tableRows = cats.length + 2;                 // 標題列 + 各分類 + 合計列
    const tableBottom = SIGNIN_TABLE_Y + tableRows * SIGNIN_ROW_H;

    // 行距依字數估算：未點名 41 位時那行會折成好幾行，固定行距會讓下一行疊上來。
    // 字太大時整塊會掉出投影片（41 位全未點名那種情況），所以由大到小試，取第一個放得下的。
    // 階梯要夠密：只有 14/12 兩段時，41 人在 12pt 仍超出版面 0.06 吋（實際量出來的）。
    const layout = [14, 13, 12, 11, 10].map((fs) => {
      const perLine = Math.floor(9 / (fs / 72) * 0.62);   // 9 吋寬放得下幾個中文字
      const lh = fs / 72 * 1.35;
      let y = tableBottom + 0.18;
      const placed = lines.map((x) => {
        const body = names(x.rows).join('、');
        const wrapped = Math.max(1, Math.ceil((body.length + x.label.length + 5) / perLine));
        const item = { x, y, h: lh * wrapped, fs, body };
        y += lh * wrapped + 0.08;
        return item;
      });
      return { fs, bottom: y, placed };
    }).find((v, i, arr) => v.bottom <= 5.45 || i === arr.length - 1)!;

    layout.placed.forEach(({ x, y, h, fs, body }) => {
      s0.addText([
        { text: `${x.label}（${x.rows.length}）　`, options: { bold: true, color: x.color } },
        { text: body, options: { color: T.text } },
      ], { x: 0.5, y, w: 9, h, fontSize: fs, fontFace: 'Calibri', isTextBox: true, margin: 0 });
    });
  }

  // 1 出缺席報告
  const ATT_TABLE_Y = 1.95, ATT_ROW_H = 0.5;
  let attBottom = ATT_TABLE_Y;   // 沒有對應例會時後面的文字就接在表格起點下面
  const s1 = slide(AGENDA[0], 1);
  const a = r.attendance;
  if (a) {
    s1.addText([
      { text: 'P  出席　', options: { bold: true, color: T.accent } },
      { text: `${a.presentTotal} 人`, options: { bold: true, fontSize: 28 } },
      { text: `　／　會員人數 ${a.totalMembers} 人　／　出席率 `
        + `${a.totalMembers ? Math.round(a.presentTotal / a.totalMembers * 100) : 0}%`
        + `　／　V 來賓 ${a.guestCount} 人`, options: { color: T.sub, fontSize: 15 } },
    ], { x: 0.5, y: 1.33, w: 9, h: 0.5, fontSize: 18, fontFace: 'Calibri', isTextBox: true, margin: 0 });

    const rows: { k: string; label: string; names: string[] }[] = [
      { k: 'A', label: '缺席', names: a.absentNames },
      { k: 'L', label: '遲到/早退', names: a.lateNames },
      { k: 'M', label: '緊急醫療', names: a.medicalNames },
      { k: 'S', label: '代理人', names: a.substituteNames },
    ];
    s1.addTable([
      headerRow(['', '項目', '人數', '名單']),
      ...rows.map(x => [
        { text: x.k, options: { bold: true, color: T.accent, align: 'center' as const } },
        { text: x.label, options: { bold: true } },
        { text: `${x.names.length} 人`, options: { align: 'center' as const } },
        { text: x.names.join('、') || '—', options: { fontSize: 13 } },
      ]),
    ], { ...tableOpts, y: ATT_TABLE_Y, colW: [0.5, 1.6, 1, 5.9], rowH: ATT_ROW_H });

    // 同簽到那張：底部要用「列數 × 列高」算，列數含標題列
    attBottom = ATT_TABLE_Y + (rows.length + 1) * ATT_ROW_H;
    if (a.unmarked > 0) {
      s1.addText(`還有 ${a.unmarked} 位會員沒有點名紀錄`, {
        x: 0.5, y: attBottom + 0.1, w: 9, h: 0.3, fontSize: 13, color: T.accent,
        fontFace: 'Calibri', isTextBox: true, margin: 0,
      });
      attBottom += 0.4;
    }
  } else {
    s1.addText('尚未對應例會場次', { x: 0.5, y: 2, w: 9, h: 0.5, fontSize: 16, color: T.sub, fontFace: 'Calibri', isTextBox: true });
  }
  if (r.attendanceNote?.trim()) {
    s1.addText(r.attendanceNote.trim(), {
      x: 0.5, y: attBottom + 0.12, w: 9, h: 0.5, fontSize: 14, color: T.sub,
      fontFace: 'Calibri', isTextBox: true, margin: 0,
    });
  }

  // 2 / 4 / 5 來賓（表格，超過 7 列自動分頁）
  const guestSlides = (title: string, index: number, rows: GuestRow[]) => {
    const pages = chunk(rows, 7);
    if (pages.length === 0) {
      const s = slide(title, index);
      s.addText('（無）', { x: 0.5, y: 2, w: 9, h: 0.4, fontSize: 16, color: T.sub, fontFace: 'Calibri', isTextBox: true });
      return;
    }
    pages.forEach((page, i) => {
      const s = slide(pages.length > 1 ? `${title}（${i + 1}/${pages.length}）` : title, index);
      s.addTable([headerRow(GUEST_HEADERS), ...page.map(g => guestCells(g).map(t => ({ text: t })))],
        { ...tableOpts, colW: [0.7, 1.1, 1.3, 2.3, 1.3, 2.3], rowH: 0.5 });
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
      : [{ text: '（無）', options: { color: T.sub } }],
    { x: 0.6, y: 1.5, w: 8.8, h: 3.5, fontSize: 17, fontFace: 'Calibri', color: T.text, isTextBox: true, paraSpaceAfter: 8 },
  );

  guestSlides(AGENDA[3], 4, r.lastWeekGuests);
  guestSlides(AGENDA[4], 5, r.earlierGuests);

  // 6 續約（每頁 8 列，與原簡報一致）
  const renewalPages = chunk(r.renewals, 8);
  if (renewalPages.length === 0) {
    const s = slide(AGENDA[5], 6);
    s.addText('未來三個月無到期會員', { x: 0.5, y: 2, w: 9, h: 0.4, fontSize: 16, color: T.sub, fontFace: 'Calibri', isTextBox: true });
  } else {
    renewalPages.forEach((page, i) => {
      const s = slide(renewalPages.length > 1 ? `${AGENDA[5]}（${i + 1}/${renewalPages.length}）` : AGENDA[5], 6);
      s.addTable([headerRow(RENEWAL_HEADERS), ...page.map(m => renewalCells(m).map((t, ci) => ({
        text: t, options: ci >= 3 && ci <= 5 ? { align: 'center' as const } : {},
      })))], { ...tableOpts, colW: [1.1, 1.15, 1.95, 0.6, 0.6, 0.6, 1.5, 1.5], rowH: 0.46 });
    });
  }

  // 7 / 8 文字段
  const noteSlide = (title: string, index: number, text?: string) => {
    const s = slide(title, index);
    const lines = (text ?? '').split('\n').map(l => l.trim()).filter(Boolean);
    s.addText(
      lines.length
        ? lines.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < lines.length - 1 } }))
        : [{ text: '（無）', options: { color: T.sub } }],
      { x: 0.6, y: 1.5, w: 8.8, h: 3.5, fontSize: 17, fontFace: 'Calibri', color: T.text, isTextBox: true, paraSpaceAfter: 8 },
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
    ], { ...tableOpts, colW: [0.5, 5.3, 1.6, 1.6], rowH: 0.48, fill: { color: T.zebra } });
  }

  await pres.writeFile({ fileName });
}
