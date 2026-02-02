
import { Activity, ActivityType, AdminUser, UserRole } from './types';

export const INITIAL_ACTIVITIES: Activity[] = [
  {
    id: '1',
    type: ActivityType.REGULAR,
    title: '長展分會週二早晨例會',
    date: '2024-06-18 06:30',
    location: '台北市大安區忠孝東路四段 218 號 (阿波羅大廈)',
    cost: 500,
    image: 'https://picsum.photos/seed/meeting1/800/400',
    description: '每週一次的能量交流，精準商務對接。歡迎各界菁英蒞臨指導。',
    status: 'active'
  },
  {
    id: '2',
    type: ActivityType.SPECIAL,
    title: '長展分會年度商務博覽會',
    date: '2024-07-20 09:00',
    location: '台北世界貿易中心一館',
    cost: 1500,
    image: 'https://picsum.photos/seed/expo1/800/400',
    description: '跨界合作，共創商機。展現分會實力，尋找合作夥伴的最佳時機。',
    status: 'active'
  }
];

export const INITIAL_ADMINS: AdminUser[] = [
  {
    id: 'super-admin-01',
    username: 'admin',
    password: 'password123',
    role: UserRole.SUPER_ADMIN
  }
];
