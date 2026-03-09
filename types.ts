
export enum ActivityType {
  REGULAR = '例會',
  SPECIAL = '精選活動'
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
}

// 新增：出席紀錄介面
export interface AttendanceRecord {
  id?: string | number;
  activity_id: string;
  member_id: string;
  status: AttendanceStatus;
  updated_at?: string;
}
