
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Menu, X, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import Home from './pages/Home';
import ActivityDetail from './pages/ActivityDetail';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';
import MemberList from './pages/MemberList'; // 新增 import
import { Activity, Registration, AdminUser, Member, AttendanceRecord, AttendanceStatus } from './types';
import { INITIAL_ACTIVITIES, INITIAL_ADMINS, INITIAL_MEMBERS } from './constants'; // 新增 import

const getEnv = (key: string): string | undefined => {
  try {
    return (import.meta as any)?.env?.[key];
  } catch (e) {
    return undefined;
  }
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || 'https://qxoglhkfxxqsjefynzqn.supabase.co'; 
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4b2dsaGtmeHhxc2plZnluenFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzQwNTAsImV4cCI6MjA4NTYxMDA1MH0.gLvcHgY0rqLd26Nw61_M7nmjaz4TUsP9VL-XxN5wNSU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const Header: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');

  if (isAdminPage) return null;

  return (
    <nav className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center gap-2">
              <div className="w-8 h-8 bg-red-600 rounded-md flex items-center justify-center text-white font-bold">長</div>
              <span className="text-xl font-bold tracking-tight">長展分會活動報名</span>
            </Link>
          </div>
          <div className="hidden sm:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 hover:text-red-600 transition-colors font-medium">活動首頁</Link>
            <Link to="/members" className="text-gray-700 hover:text-red-600 transition-colors font-medium">會員列表</Link>
            <Link to="/admin" className="text-gray-500 hover:text-gray-900 flex items-center gap-1 border border-gray-200 px-3 py-1 rounded-full text-sm font-bold">後台管理</Link>
          </div>
          <div className="sm:hidden flex items-center">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-500 hover:text-red-600">
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="sm:hidden bg-white border-t px-4 py-3 space-y-3 shadow-lg">
          <Link to="/" onClick={() => setIsOpen(false)} className="block text-gray-700 font-bold">活動首頁</Link>
          <Link to="/members" onClick={() => setIsOpen(false)} className="block text-gray-700 font-bold">會員列表</Link>
          <Link to="/admin" onClick={() => setIsOpen(false)} className="block text-gray-500 text-sm font-bold">後台管理</Link>
        </div>
      )}
    </nav>
  );
};

const Footer: React.FC = () => {
  const location = useLocation();
  if (location.pathname.startsWith('/admin')) return null;
  return (
    <footer className="bg-white border-t py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex justify-center items-center gap-2 mb-4">
          <div className="w-6 h-6 bg-red-600 rounded-md flex items-center justify-center text-white text-xs font-bold">長</div>
          <span className="font-bold text-gray-800 tracking-wider">BNI 長展分會</span>
        </div>
        <p className="text-gray-400 text-xs">&copy; 2026 長展分會活動報名系統. All rights reserved.</p>
      </div>
    </footer>
  );
};

const App: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [members, setMembers] = useState<Member[]>([]); // 新增 members state
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]); // 新增 attendance state
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    const saved = sessionStorage.getItem('current_user');
    return saved ? JSON.parse(saved) : null;
  });

  // 修改：加入參數控制是否顯示 Loading 遮罩
  // 預設為 false (靜默更新)，只有初始化時傳入 true
  const fetchData = async (isInitialLoad = false) => {
    console.log('fetchData started, isInitialLoad:', isInitialLoad);
    if (isInitialLoad) setLoading(true);
    
    const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms));

    try {
      console.log('Fetching activities...');
      
      // 1. 優先獲取活動資料 (首頁最重要)
      const { data: actData } = await Promise.race([
        supabase.from('activities').select('*').order('date', { ascending: true }).order('time', { ascending: true }),
        timeout(3000)
      ]) as any;
      
      if (actData) {
        const mappedActs = actData.map((a: any) => ({
          ...a,
          status: a.status || 'active'
        }));
        setActivities(mappedActs);
      }
      
      // 2. 拿到活動後就先關閉 Loading，讓使用者看到內容
      if (isInitialLoad) {
        console.log('Activities loaded, turning off initial loading');
        setLoading(false);
      }

      // 3. 背景繼續抓取其他次要資料
      console.log('Fetching secondary data in background...');
      
      const [regRes, userRes, memberRes, attendanceRes] = await Promise.allSettled([
        supabase.from('registrations').select('*').order('created_at', { ascending: false }),
        supabase.from('admins').select('*'),
        supabase.from('members').select('*'),
        supabase.from('attendance').select('*')
      ]);

      if (regRes.status === 'fulfilled' && regRes.value.data) setRegistrations(regRes.value.data);
      if (userRes.status === 'fulfilled' && userRes.value.data) setUsers(userRes.value.data);
      if (memberRes.status === 'fulfilled' && memberRes.value.data) setMembers(memberRes.value.data);
      if (attendanceRes.status === 'fulfilled' && attendanceRes.value.data) setAttendance(attendanceRes.value.data as AttendanceRecord[]);

      console.log('All data fetching attempts completed');

    } catch (err) {
      console.error('Critical fetch error:', err);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  };

  useEffect(() => {
    console.log('App mounted, calling fetchData');
    fetchData(true); 
    
    // 安全機制：如果 4 秒後還在轉圈圈，強制關閉 Loading 遮罩
    const safetyTimer = setTimeout(() => {
      console.log('Safety timer triggered, forcing loading to false');
      setLoading(false);
    }, 4000);
    
    return () => clearTimeout(safetyTimer);
  }, []);

  const handleLogin = (user: AdminUser) => {
    setCurrentUser(user);
    sessionStorage.setItem('current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('current_user');
  };

  // 處理圖片上傳
  const handleUploadImage = async (file: File): Promise<string> => {
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `activity-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('activity-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.warn('Supabase Storage 上傳失敗，嘗試轉為壓縮 Base64', uploadError.message);
        throw uploadError; 
      }

      const { data } = supabase.storage
        .from('activity-images')
        .getPublicUrl(filePath);

      return data.publicUrl;

    } catch (error: any) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_WIDTH = 1024;
            const MAX_HEIGHT = 1024;
            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('瀏覽器不支援 Canvas 處理'));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            resolve(dataUrl);
          };
          img.onerror = () => reject(new Error('圖片處理失敗'));
        };
        reader.onerror = () => reject(new Error('檔案讀取失敗'));
      });
    }
  };

  // 修改：回傳 Promise<boolean> 以便前端判斷
  const handleRegister = async (newReg: Registration): Promise<boolean> => {
    const { id, ...regData } = newReg as any;
    const { error } = await supabase.from('registrations').insert([regData]);
    if (error) {
      alert('報名失敗：' + error.message);
      return false;
    } else {
      await fetchData(); 
      return true;
    }
  };

  const handleUpdateActivity = async (updated: Activity) => {
    const { status, ...updateData } = updated as any;
    const { error } = await supabase.from('activities').update(updateData).eq('id', updated.id);
    if (error) alert('更新失敗：' + error.message);
    else fetchData();
  };

  const handleAddActivity = async (newAct: Activity) => {
    const { id, status, ...actData } = newAct as any;
    const { error } = await supabase.from('activities').insert([actData]);
    if (error) alert('新增活動失敗：' + error.message);
    else fetchData();
  };

  const handleDeleteActivity = async (id: string | number) => {
    await supabase.from('registrations').delete().eq('activityId', id);
    const { error } = await supabase.from('activities').delete().eq('id', id);
    if (error) alert('刪除失敗：' + error.message);
    else fetchData();
  };

  const handleDeleteRegistration = async (id: string | number) => {
    const { error } = await supabase.from('registrations').delete().eq('id', id);
    if (error) alert('刪除報名紀錄失敗：' + error.message);
    else fetchData();
  };

  const handleUpdateRegistration = async (updated: Registration) => {
    const { error } = await supabase.from('registrations').update(updated).eq('id', updated.id);
    if (error) alert('更新報名狀態失敗：' + error.message);
    else fetchData();
  };

  const handleAddUser = async (newUser: AdminUser) => {
    const { id, ...userData } = newUser as any;
    const { error } = await supabase.from('admins').insert([userData]);
    if (error) alert('新增管理員失敗：' + error.message);
    else fetchData();
  };

  const handleDeleteUser = async (id: string | number) => {
    const { error } = await supabase.from('admins').delete().eq('id', id);
    if (error) {
      alert('刪除人員失敗：' + error.message);
    } else {
      fetchData();
    }
  };

  // 會員管理相關功能 (新增)
  const handleAddMember = async (newMember: Member) => {
    const { id, ...memberData } = newMember as any;
    const { error } = await supabase.from('members').insert([memberData]);
    if (error) alert('新增會員失敗：' + error.message);
    else fetchData();
  };

  const handleUpdateMember = async (updated: Member) => {
    const { error } = await supabase.from('members').update(updated).eq('id', updated.id);
    if (error) alert('更新會員失敗：' + error.message);
    else fetchData();
  };

  const handleDeleteMember = async (id: string | number) => {
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) alert('刪除會員失敗：' + error.message);
    else fetchData();
  };

  // 新增：處理出席紀錄更新 (Upsert)
  const handleUpdateAttendance = async (activityId: string, memberId: string, status: AttendanceStatus) => {
    // 樂觀更新 (Optimistic Update): 先更新前端狀態，讓 UI 立即反應
    const now = new Date().toISOString();
    const tempId = `temp-${Date.now()}`;
    
    // 更新本地 state
    setAttendance(prev => {
      const existingIndex = prev.findIndex(r => String(r.activity_id) === String(activityId) && String(r.member_id) === String(memberId));
      if (existingIndex >= 0) {
        const newArr = [...prev];
        newArr[existingIndex] = { ...newArr[existingIndex], status, updated_at: now };
        return newArr;
      } else {
        return [...prev, { id: tempId, activity_id: activityId, member_id: memberId, status, updated_at: now }];
      }
    });

    try {
      // 使用 upsert 寫入 Supabase (依賴 activity_id, member_id 的 unique constraint)
      const { data, error } = await supabase
        .from('attendance')
        .upsert(
          { activity_id: String(activityId), member_id: String(memberId), status, updated_at: now },
          { onConflict: 'activity_id,member_id' }
        )
        .select();

      if (error) {
        console.error('Attendance update failed:', error);
        // 如果失敗，應該要回復狀態 (這裡簡化處理：重新 fetch)
        fetchData(); 
      } 
    } catch (err) {
      console.error('API error:', err);
      fetchData();
    }
  };

  // 新增：刪除出席紀錄 (重置/恢復)
  const handleDeleteAttendance = async (activityId: string, memberId: string) => {
    // 樂觀更新：先從本地 state 移除
    setAttendance(prev => prev.filter(r => !(String(r.activity_id) === String(activityId) && String(r.member_id) === String(memberId))));

    try {
       const { error } = await supabase
         .from('attendance')
         .delete()
         .match({ activity_id: String(activityId), member_id: String(memberId) });

       if (error) {
         console.error('Delete attendance failed:', error);
         fetchData(); // 失敗則還原
       }
    } catch (err) {
       console.error('API error:', err);
       fetchData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-red-600" size={56} />
          <p className="text-gray-400 font-bold tracking-widest text-xs uppercase">Connecting Database</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow bg-gray-50/30">
          <Routes>
            <Route path="/" element={<Home activities={activities} />} />
            <Route path="/members" element={<MemberList members={members} />} /> {/* 新增路由 */}
            <Route path="/activity/:id" element={<ActivityDetail activities={activities} onRegister={handleRegister} registrations={registrations} members={members} />} />
            <Route path="/admin/login" element={currentUser ? <Navigate to="/admin" /> : <LoginPage users={users} onLogin={handleLogin} />} />
            <Route path="/admin/*" element={
              currentUser ? (
                <AdminDashboard 
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  activities={activities} 
                  registrations={registrations}
                  users={users}
                  members={members} // 傳遞 members
                  attendance={attendance} // 傳遞出席紀錄
                  onUpdateActivity={handleUpdateActivity}
                  onAddActivity={handleAddActivity}
                  onDeleteActivity={handleDeleteActivity}
                  onUpdateRegistration={handleUpdateRegistration}
                  onDeleteRegistration={handleDeleteRegistration}
                  onAddUser={handleAddUser}
                  onDeleteUser={handleDeleteUser}
                  onAddMember={handleAddMember} // 傳遞會員操作
                  onUpdateMember={handleUpdateMember} // 傳遞會員操作
                  onDeleteMember={handleDeleteMember} // 傳遞會員操作
                  onUpdateAttendance={handleUpdateAttendance} // 傳遞出席更新函數
                  onDeleteAttendance={handleDeleteAttendance} // 新增：傳遞出席刪除函數
                  onUploadImage={handleUploadImage} 
                />
              ) : (
                <Navigate to="/admin/login" />
              )
            } />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
