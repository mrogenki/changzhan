export enum ActivityType {
  REGULAR = '會員專屬',
  SPECIAL = '一般活動'
}
export enum UserRole {
  STAFF = '工作人員',
  MANAGER = '管理員',
  SUPER_ADMIN = '總管理員'
}
// 新增：出席狀態
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
  images?: string[]; // 新增：多張照片
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
  guest_welcome_message?: string | null; // 新增：來賓歡迎訊息（LINE），留空走全域預設
}
export interface Registration {
  id: string | number;
  activityId: string | number;
  name: string;
  phone: string;
  email: string;

  // 以下欄位若資料庫尚未建立，設為選填以避免前端錯誤
  company?: string;
  title?: string;
  referrer?: string;
  check_in_status?: boolean; // 後台管理用：報到狀態
  paid_amount?: number;      // 後台管理用：繳費金額
  guest_id?: number | null;  // 新增：關聯到 guests 表（來賓 LINE 綁定）

  created_at: string;
}
export interface AdminUser {
  id: string;
  name: string;
  phone: string; // 改為手機號碼
  role: UserRole;
  password?: string;
}
export interface Member {
  id: string | number;
  member_no: string | number; // 修改：允許 string 或 number
  industry_chain: '美食' | '工程' | '健康' | '幸福' | '工商'; // 產業鏈
  industry_category: string; // 行業別
  name: string; // 大名
  company: string; // 品牌/公司名稱
  website?: string; // 網站
  intro?: string; // 新增：會員簡介

  // 新增：會籍管理
  status?: 'active' | 'inactive'; // active=活躍(顯示), inactive=停權/離會(隱藏)
  join_date?: string; // 入會日期
  end_date?: string; // 會籍到期日
  birthday?: string; // 新增：生日
  picture?: string; // 新增：會員照片/Logo
  // 新增：公司與聯絡資訊
  company_title?: string; // 公司抬頭 (發票用)
  tax_id?: string;        // 統一編號
  mobile_phone?: string;  // 手機號碼
  landline?: string;      // 室內電話
  address?: string;       // 地址
  group_name?: string;    // 組別 (e.g. 第1組、三尊
