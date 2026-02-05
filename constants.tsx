
import { Activity, ActivityType, AdminUser, UserRole } from './types';

export const INITIAL_ACTIVITIES: Activity[] = [
  {
    id: '1',
    type: ActivityType.REGULAR,
    title: '長展分會週二早晨例會',
    date: '2024-06-18',
    time: '06:30',
    location: '台北市大安區忠孝東路四段 218 號 (阿波羅大廈)',
    cost: 500,
    image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=2069&auto=format&fit=crop',
    description: '每週一次的能量交流，精準商務對接。歡迎各界菁英蒞臨指導。',
    status: 'active'
  }
];

export const INITIAL_ADMINS: AdminUser[] = [
  {
    id: 'super-admin-01',
    name: '總管理員',
    email: 'admin@changzhan.com',
    password: 'password123',
    role: UserRole.SUPER_ADMIN
  }
];
