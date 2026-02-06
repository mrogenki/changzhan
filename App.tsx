
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Menu, X, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import Home from './pages/Home';
import ActivityDetail from './pages/ActivityDetail';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';
import { Activity, Registration, AdminUser } from './types';
import { INITIAL_ACTIVITIES, INITIAL_ADMINS } from './constants';

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
          <div className="w-6 h-6 bg-red-600 rounded-sm flex items-center justify-center text-white text-xs font-bold">長</div>
          <span className="font-bold text-gray-800 tracking-wider">BNI 長展分會</span>
        </div>
        <p className="text-gray-400 text-xs">&copy; 2024 長展分會活動報名系統. All rights reserved.</p>
      </div>
    </footer>
  );
};

const App: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    const saved = sessionStorage.getItem('current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // 獲取活動
      const { data: actData } = await supabase.from('activities').select('*').order('date', { ascending: true }).order('time', { ascending: true });
      if (actData && actData.length > 0) {
        // 資料庫沒有 status 欄位，手動補上預設值，避免前端錯誤
        const mappedActs = actData.map((a: any) => ({
          ...a,
          status: a.status || 'active'
        }));
        setActivities(mappedActs);
      } else if (actData && actData.length === 0) {
        // 只有在資料庫真的完全沒資料時才初始化一次
        // 排除 id (讓 DB 自增) 和 status (DB 無此欄位)
        const initActs = INITIAL_ACTIVITIES.map(({ id, status, ...rest }) => rest);
        const { data: inserted } = await supabase.from('activities').insert(initActs).select();
        if (inserted) {
          const mappedInserted = inserted.map((a: any) => ({
            ...a,
            status: a.status || 'active'
          }));
          setActivities(mappedInserted);
        }
      }

      // 獲取報名
      const { data: regData } = await supabase.from('registrations').select('*').order('created_at', { ascending: false });
      if (regData) setRegistrations(regData);
      
      // 獲取管理員
      const { data: userData, error: userError } = await supabase.from('admins').select('*');
      if (userData && userData.length > 0) {
        setUsers(userData);
      } else if (!userError && userData && userData.length === 0) {
        // 資料庫空了，初始化管理員 (排除 ID，讓 DB 產生 UUID)
        const initAdmins = INITIAL_ADMINS.map(({ id, ...rest }) => rest);
        const { data: inserted } = await supabase.from('admins').insert(initAdmins).select();
        if (inserted) setUsers(inserted);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogin = (user: AdminUser) => {
    setCurrentUser(user);
    sessionStorage.setItem('current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('current_user');
  };

  const handleRegister = async (newReg: Registration) => {
    const { id, ...regData } = newReg as any;
    const { error } = await supabase.from('registrations').insert([regData]);
    if (error) alert('報名失敗：' + error.message);
    else fetchData(); 
  };

  const handleUpdateActivity = async (updated: Activity) => {
    // 移除 status 和 id (update 需要 eq id，但 payload 不一定要包含)
    const { status, ...updateData } = updated as any;
    const { error } = await supabase.from('activities').update(updateData).eq('id', updated.id);
    if (error) alert('更新失敗：' + error.message);
    else fetchData();
  };

  const handleAddActivity = async (newAct: Activity) => {
    // 移除前端產生的 ID 和 status，避免寫入 DB 錯誤
    const { id, status, ...actData } = newAct as any;
    const { error } = await supabase.from('activities').insert([actData]);
    if (error) alert('新增活動失敗：' + error.message);
    else fetchData();
  };

  const handleDeleteActivity = async (id: string | number) => {
    // 先刪除報名資料以防外鍵約束 (改為 activityId)
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
    // 重要：移除前端產生的 ID，讓 Supabase 產生 UUID
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
            <Route path="/activity/:id" element={<ActivityDetail activities={activities} onRegister={handleRegister} registrations={registrations} />} />
            <Route path="/admin/login" element={currentUser ? <Navigate to="/admin" /> : <LoginPage users={users} onLogin={handleLogin} />} />
            <Route path="/admin/*" element={
              currentUser ? (
                <AdminDashboard 
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  activities={activities} 
                  registrations={registrations}
                  users={users}
                  onUpdateActivity={handleUpdateActivity}
                  onAddActivity={handleAddActivity}
                  onDeleteActivity={handleDeleteActivity}
                  onUpdateRegistration={handleUpdateRegistration}
                  onDeleteRegistration={handleDeleteRegistration}
                  onAddUser={handleAddUser}
                  onDeleteUser={handleDeleteUser}
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
