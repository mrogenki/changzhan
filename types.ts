
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
  id: string;
  type: ActivityType;
  title: string;
  date: string;
  location: string;
  cost: number;
  image: string;
  description: string;
  status: 'active' | 'closed';
}

export interface Registration {
  id: string;
  activityId: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  title: string;
  referrer?: string;
  checkInStatus: boolean;
  paidAmount?: number;
  registeredAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string; // 僅供登入與新增時使用
}
