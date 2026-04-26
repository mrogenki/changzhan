export enum ActivityType {
    REGULAR = '會員專屬',
    SPECIAL = '一般活動',
    REGULAR_MEETING = '例會活動',
    BUSINESS_TRAINING = '商務培訓',
    COFFEE_MEETING = '咖啡會議'
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
    price: number;
    picture: string;
    description: string;
    status?: 'active' | 'closed';
    guest_welcome_message?: string | null;
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
    created_at: string;
}

export interface AdminUser {
    id: string;
    name: string;
    phone: string;
    role: UserRole;
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
