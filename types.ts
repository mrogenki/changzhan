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
  descript
