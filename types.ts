export enum ActivityType {
    REGULAR = '會員專屬',
    SPECIAL = '一般活動',
    REGULAR_MEETING = '例會活動',
    BUSINESS_TRAINING = '商務培訓',
    GROUP_MEETING = '組聚',
    /** 例會後的執事會。一律是內部活動（DB trigger 會釘住 is_internal） */
    LEADERSHIP_MEETING = '執事會'
}

export enum UserRole {
    STAFF = '工作人員',
    MANAGER = '管理員',
    SUPER_ADMIN = '總管理員'
}

// 新增:出席狀態
export enum AttendanceStatus {
    PRESENT = 'present',       // 出席
    ABSENT = 'absent',         // 缺席
    LATE = 'late',             // 遲到
    MEDICAL = 'medical',       // 病假
    SUBSTITUTE = 'substitute'  // 代理
}

export enum FinanceType {
    INCOME = 'income',
    EXPENSE = 'expense'
}

export enum FinanceCategory {
    ACTIVITY_FEE = '活動費用',
    MEMBER_FEE = '會費',
    VENUE_FEE = '場地費',
    MEAL_FEE = '餐飲費',
    MARKETING = '行銷推廣',
    OTHER = '其他'
}

export enum MilestoneType {
    ACTIVITY = '活動剪影',
    AWARD = '得獎紀錄',
    OTHER = '其他'
}

export interface Milestone {
    id: string | number;
    type: MilestoneType;
    title: string;
    date: string;
    image_url: string;
    images?: string[];
    description: string;
    created_at?: string;
}

export interface FinanceRecord {
    id: string | number;
    type: FinanceType;
    category: FinanceCategory | string;
    amount: number;
    date: string;
    description: string;
    activity_id?: string | number;
    created_at?: string;
}

export interface Activity {
    id: string | number;
    type: ActivityType;
    title: string;
    date: string;
    time: string;
    location: string;
    price: number;              // 一般價（來賓）
    member_price?: number | null; // 會員價，null = 不分級
    picture: string;
    description: string;
    status?: 'active' | 'closed';
    guest_welcome_message?: string | null;
    /** 小組長在 LINE 自助發起的組聚才有；後台建立的是 null */
    created_by_member_id?: number | null;
    host_group?: string | null;
    /** 內部活動：不上官網、不上行事曆，未登入者讀不到（執事會一律為 true） */
    is_internal?: boolean;
}

/** 執事會的會議記錄，一場會議一份 */
export interface MeetingMinutes {
    id: number;
    activity_id: number;
    /** 對應的例會場次：出缺席報告與來賓分組都以它為準 */
    regular_meeting_activity_id?: number | null;
    attendance_note?: string | null;   // 1 出缺席報告補充
    application_note?: string | null;  // 3 入會申請追蹤
    guest_note?: string | null;        // 2/4/5 來賓追蹤補充
    renewal_note?: string | null;      // 6 續約狀況補充
    process_note?: string | null;      // 7 會議流程優化＆建議事項
    misc_note?: string | null;         // 8 臨時動議
    created_by?: string | null;
    created_at?: string;
    updated_at?: string;
}

/** 會員的最新紅綠燈（PALMS）。來源是 bni-report 上傳的報表，changzhan 只讀不寫 */
export interface MemberTrafficLight {
    member_id: number;
    raw_name?: string;
    light?: 'B' | 'G' | 'Y' | 'R' | string | null;
    total_score?: number | null;
    attendance_rate?: number | null;
    attendance?: number | null;
    absent?: number | null;
    late?: number | null;
    sick?: number | null;
    substitute?: number | null;
    guests?: number | null;
    one_on_one?: number | null;
    education?: number | null;
    given_refs?: number | null;
    received_refs?: number | null;
    deal_value?: number | null;
    date_range?: string | null;
}

/** 來賓追蹤：一位來賓一筆，狀況跨週延續。議程的今日／上週／之前是依 visit_date 分組 */
export interface GuestFollowUp {
    id: number;
    guest_name: string;
    industry?: string | null;
    group_name?: string | null;
    member_name?: string | null;
    interviewer?: string | null;
    status_note?: string | null;
    visit_date?: string | null;
    state: 'tracking' | 'applied' | 'joined' | 'dropped';
    registration_id?: number | null;
}

/** 363 續約追蹤：一位會員一筆，滾動更新（到期日與組別讀 members） */
export interface RenewalNote {
    member_id: number;
    status_note?: string | null;
    light?: number | null;
    committee?: string | null;
    guest_count?: number | null;
}

/** 會議待辦事項 */
export interface MeetingActionItem {
    id: number;
    minutes_id: number;
    content: string;
    /** 負責人是會員就連 id；外部人士只留名字 */
    owner_member_id?: number | null;
    owner_name?: string | null;
    due_date?: string | null;
    status: 'pending' | 'done';
    done_at?: string | null;
}

export interface Registration {
    id: string | number;
    activityId: string | number;
    name: string;
    phone: string;
    email: string;
    company?: string;
    title?: string;
    referrer?: string;
    check_in_status?: boolean;
    paid_amount?: number;
    guest_id?: number | null;
    notes?: string | null;
    created_at: string;
}

export interface AdminUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    // 可編輯／僅檢視的總開關。角色決定「看得到哪些頁」，這個決定「能不能改」。
    // 未設定時一律視為可編輯，與舊資料相容。
    can_edit?: boolean;
    phone?: string;
    password?: string;
}

export interface Member {
    id: string | number;
    member_no: string | number;
    industry_chain: '美食' | '工程' | '健康' | '幸福' | '工商';
    industry_category: string;
    name: string;
    company: string;
    website?: string;
    email?: string;
    intro?: string;
    status?: 'active' | 'inactive';
    join_date?: string;
    end_date?: string;
    birthday?: string;
    picture?: string;
    company_title?: string;
    tax_id?: string;
    mobile_phone?: string;
    landline?: string;
    address?: string;
    group_name?: string;
    line_user_id?: string | null;
    /** 分會職務（可複選），有效值見 constants.tsx 的 CHAPTER_POSITIONS。
     *  含「小組長」的人可以在 LINE 自助發起組聚（/liff/signup?host=1）。 */
    positions?: string[];
}

export interface AttendanceRecord {
    id?: string | number;
    activity_id: string;
    member_id: string;
    status: AttendanceStatus;
    updated_at?: string;
}

export interface Guest {
    id: number;
    created_at: string;
    line_user_id: string;
    name: string;
    phone: string;
    email?: string;
    company?: string;
    notes?: string | null;
}

// 新增：文件管理
export type DocumentCategory =
    | '例會資料'
    | '商務培訓'
    | '會議記錄'
    | '表單範本'
    | '財務文件'
    | '章程規範'
    | '其他';

export interface ChapterDocument {
    id: string | number;
    title: string;
    description?: string;
    category: DocumentCategory;
    file_name: string;       // 原始檔名
    file_path: string;       // Supabase Storage 中的路徑
    file_url: string;        // Public URL
    file_size: number;       // 位元組
    file_type: string;       // MIME type
    uploaded_by?: string;    // 上傳者姓名
    created_at?: string;
    updated_at?: string;
}

// 收款工具：一個「收款項目」（每月餐費、某場活動…）底下掛多筆「明細」
export type PaymentMethod = 'cash' | 'linepay' | 'transfer';

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
    cash: '現金',
    linepay: 'LINE Pay',
    transfer: '匯款',
};

export interface PaymentBatch {
    id: number;
    title: string;
    default_amount: number;        // 一般價
    member_amount?: number | null; // 會員價，null = 不分級
    period?: string | null;        // '2026-09'，只有每月餐費會填
    activity_id?: number | null;
    due_date?: string | null;
    finance_category: string;      // 寫入收支時的分類
    status: 'open' | 'closed';
    note?: string | null;
    created_by?: string | null;
    created_at?: string;
}

export interface PaymentItem {
    id: number;
    batch_id: number;
    payee_name: string;            // 姓名快照，來賓／家屬也一定有
    payee_phone?: string | null;
    member_id?: number | null;
    guest_id?: number | null;
    registration_id?: number | null;
    amount_due: number;
    amount_paid: number;
    method?: PaymentMethod | null;
    paid_at?: string | null;
    note?: string | null;
    recorded_by?: string | null;
}

// 應付帳款：即將發生但還沒付的支出。確認支付後才會寫進 finance_records
export type PayableStatus = 'pending' | 'paid' | 'cancelled';

export interface PayableRecord {
    id: number;
    title: string;
    category: string;
    amount: number;              // 允許負數（沖銷／退回）
    due_date?: string | null;    // 預計支付日
    status: PayableStatus;
    note?: string | null;
    activity_id?: number | null;
    finance_record_id?: number | null;
    paid_at?: string | null;
    paid_by?: string | null;
    created_by?: string | null;
    created_at?: string;
}
