
export enum ActivityType {
  REGULAR = '例會',
  SPECIAL = '精選活動'
}

export enum UserRole {
  STAFF = '工作人員',
  MANAGER = '管理員',
  SUPER_ADMIN = '總管理員'
}

export interface Activity {
  id: string | number; // 資料庫可能是 int8 或 uuid，保留彈性
  type: ActivityType;
  title: string;
  date: string; // 格式: YYYY-MM-DD
  time: string; // 格式: HH:mm
  location: string;
  price: number; // 對應資料庫 price (int4)
  picture: string; // 對應資料庫 picture (text)
  description: string;
  status?: 'active' | 'closed'; // 設為選填，若資料庫無此欄位則由前端預設
}

export interface Registration {
  id: string | number;
  activity_id: string | number; // 改為 snake_case
  name: string;
  phone: string;
  email: string;
  company: string;
  title: string;
  referrer?: string;
  check_in_status: boolean; // 改為 snake_case
  paid_amount?: number; // 改為 snake_case
  created_at: string; // 改為 snake_case (通常 DB 欄位為 created_at)
}

export interface AdminUser {
  id: string; // UUID
  name: string;
  email: string;
  role: UserRole;
  password?: string; // 僅供登入與新增時使用
}
