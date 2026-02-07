
import { Activity, ActivityType, AdminUser, UserRole, Member } from './types';

export const INITIAL_ACTIVITIES: Activity[] = [
  {
    id: '1',
    type: ActivityType.REGULAR,
    title: '長展分會週二早晨例會',
    date: '2024-06-18',
    time: '06:30',
    location: '台北市大安區忠孝東路四段 218 號 (阿波羅大廈)',
    price: 500,
    picture: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=2069&auto=format&fit=crop',
    description: '每週一次的能量交流，精準商務對接。歡迎各界菁英蒞臨指導。',
    status: 'active'
  }
];

export const INITIAL_ADMINS: AdminUser[] = [
  {
    id: 'super-admin-01',
    name: '總管理員',
    phone: '0925981577',
    password: '981577',
    role: UserRole.SUPER_ADMIN
  }
];

export const INITIAL_MEMBERS: Member[] = [
  {
    id: 'm1',
    member_no: '001',
    industry_chain: '工商',
    industry_category: '網站設計',
    name: '王小明',
    company: '長展科技',
    website: 'https://example.com'
  },
  {
    id: 'm2',
    member_no: '002',
    industry_chain: '幸福',
    industry_category: '婚禮顧問',
    name: '陳美麗',
    company: '幸福婚顧',
    website: ''
  }
];
