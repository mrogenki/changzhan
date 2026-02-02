import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Menu, X, Loader2, Database, Copy, CheckCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import Home from './pages/Home';
import ActivityDetail from './pages/ActivityDetail';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';
import { Activity, Registration, AdminUser } from './types';
import { INITIAL_ACTIVITIES, INITIAL_ADMINS } from './constants';

// 初始化 Supabase
const supabaseUrl = 'https://qxoglhkfxxqsjefynzqn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4b2dsaGtmeHhxc2plZnluenFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzQwNTAsImV4cCI6MjA4NTYxMDA1MH0.gLvcHgY0rqLd26Nw61_M7nmjaz4TUsP9VL-XxN5wNSU';
const supabase = createClient(supabaseUrl, supabaseKey);

const SQL_SETUP_SCRIPT = `-- 1. 建立活動表
create table if not exists activities (
  id text primary key,
  type text not null,
  title text not null,
  date text not null,
  location text not null,
  cost integer not null,
  image text,
  description text,
  status text default 'active'
);

-- 2. 建立報名表
create table if not exists registrations (
  id text primary key,
  "activityId" text references activities(id),
  name text not null,
  phone text not null,
  email text not null,
  company text,
  title text,
  referrer text,
  "checkInStatus" boolean default false,
  "paidAmount" integer default 0,
  "registeredAt" timestamp with time zone default now()
);

-- 3. 建立管理員表
create table if not exists admin_users (
  id text primary key,
  username text unique not null,
  password text not null,
  role text not null
);`;

const SetupGuide: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SETUP_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-3xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-red-100">
        <div className="bg-red-600 p-8 text-white text-center">
          <Database size={48} className="mx-auto mb-4" />
          <h1 className="text-3xl font-bold">需要設定資料庫</h1>
          <p className="text-red-100 mt-2">我們偵測到您的 Supabase 專案尚未建立所需的資料表。</p>
        </div>
        <div className="p-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 bg-red-600 text-white rounded-full text-sm">1</span>
            前往 Supabase SQL Editor
          </h2>
          <p className="text-gray-600 mb-6">請登入您的 Supabase 後台，點擊左側選單的 <strong>SQL Editor</strong> 並建立一個 <strong>New Query</strong>。</p>
          
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 bg-red-600 text-white rounded-full text-sm">2</span>
            複製並執行以下指令
          </h2>
          <div className="relative group">
            <pre className="bg-gray-900 text-gray-100 p-6 rounded-xl text-sm overflow-x-auto font-mono leading-relaxed mb-6">
              {SQL_SETUP_SCRIPT}
            </pre>
            <button 
              onClick={handleCopy}
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all backdrop-blur-sm"
            >
              {copied ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
              {copied ? '已複製' : '複製指令'}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={onRetry}
              className="flex-1 bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition-all shadow-lg active:scale-95"
            >
              我已執行完成，重新連接
            </button>
            <a 
              href="https://supabase.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 border-2 border-gray-200 text-gray-500 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 text-center transition-all"
            >
              前往 Supabase 控制台
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

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
              <span className="text-xl font-bold tracking-tight text-gray-900">長展分會活動報名</span>
            </Link>
          </div>
          
          <div className="hidden sm:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 hover:text-red-600 transition-colors">活動首頁</Link>
            <Link to="/admin" className="text-gray-500 hover:text-gray-900 flex items-center gap-1 border border-gray-200 px-3 py-1 rounded-full text-sm">
              管理後台
            </Link>
          </div>

          <div className="sm:hidden flex items-center">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-500 hover:text-red-600">
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="sm:hidden bg-white border-t px-4 py-3 space-y-3">
          <Link to="/" onClick={() => setIsOpen(false)} className="block text-gray-700 font-medium">活動首頁</Link>
          <Link to="/admin" onClick={() => setIsOpen(false)} className="block text-gray-500 text-sm">管理後台</Link>
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
          <span className="font-bold text-gray-800">長展分會</span>
        </div>
        <p className="text-gray-400 text-sm">&copy; 2024 長展分會活動報名系統. All rights reserved.</p>
      </div>
    </footer>
  );
};

const App: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbMissing, setDbMissing] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    const saved = sessionStorage.getItem('current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const fetchData = async () => {
    setLoading(true);
    setDbMissing(false);
    try {
      const { data: actData, error: actErr } = await supabase.from('activities').select('*').order('date', { ascending: true });
      const { data: userData, error: userErr } = await supabase.from('admin_users').select('*');
      const { data: regData } = await supabase.from('registrations').select('*').order('registeredAt', { ascending: false });

      // 偵測資料表是否不存在
      if (actErr?.code === 'PGRST' && actErr?.message?.includes('does not exist')) {
        setDbMissing(true);
        setLoading(false);
        return;
      }
      if (userErr?.code === 'PGRST' && userErr?.message?.includes('does not exist')) {
        setDbMissing(true);
        setLoading(false);
        return;
      }

      if (actData && actData.length > 0) setActivities(actData);
      else if (!actErr) {
        await supabase.from('activities').insert(INITIAL_ACTIVITIES);
        setActivities(INITIAL_ACTIVITIES);
      }

      if (regData) setRegistrations(regData);
      
      if (userData && userData.length > 0) setUsers(userData);
      else if (!userErr) {
        await supabase.from('admin_users').insert(INITIAL_ADMINS);
        setUsers(INITIAL_ADMINS);
      }
    } catch (err) {
      console.error('System init error:', err);
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

  // 報名功能
  const handleRegister = async (newReg: Registration) => {
    const { error } = await supabase.from('registrations').insert([newReg]);
    if (error) {
      alert(`報名失敗: ${error.message}`);
      return;
    }
    setRegistrations(prev => [newReg, ...prev]);
  };

  // 活動管理功能
  const handleUpdateActivity = async (updated: Activity) => {
    const { error } = await supabase.from('activities').update(updated).eq('id', updated.id);
    if (error) {
      alert(`更新失敗: ${error.message}`);
      return;
    }
    setActivities(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  const handleAddActivity = async (newAct: Activity) => {
    const { error } = await supabase.from('activities').insert([newAct]);
    if (error) {
      alert(`新增活動失敗: ${error.message}`);
      return;
    }
    setActivities(prev => [...prev, newAct]);
  };

  const handleDeleteActivity = async (id: string) => {
    const { error: actError } = await supabase.from('activities').delete().eq('id', id);
    if (actError) {
      alert(`刪除失敗: ${actError.message}`);
      return;
    }
    setActivities(prev => prev.filter(a => a.id !== id));
    setRegistrations(prev => prev.filter(r => r.activityId !== id));
  };

  // 報到與報名管理
  const handleDeleteRegistration = async (id: string) => {
    const { error } = await supabase.from('registrations').delete().eq('id', id);
    if (error) {
      alert(`刪除失敗: ${error.message}`);
      return;
    }
    setRegistrations(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateRegistration = async (updated: Registration) => {
    const { error } = await supabase.from('registrations').update(updated).eq('id', updated.id);
    if (error) {
      alert(`更新失敗: ${error.message}`);
      return;
    }
    setRegistrations(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  // 用戶權限管理
  const handleAddUser = async (newUser: AdminUser) => {
    const { error } = await supabase.from('admin_users').insert([newUser]);
    if (error) {
      alert(`新增人員失敗！\n原因：${error.message}`);
      return false;
    }
    setUsers(prev => [...prev, newUser]);
    return true;
  };

  const handleDeleteUser = async (id: string) => {
    const { error } = await supabase.from('admin_users').delete().eq('id', id);
    if (error) {
      alert(`刪除失敗: ${error.message}`);
      return;
    }
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin mx-auto text-red-600" size={48} />
          <p className="text-gray-500 font-medium">正在載入系統...</p>
        </div>
      </div>
    );
  }

  if (dbMissing) {
    return <SetupGuide onRetry={fetchData} />;
  }

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home activities={activities} />} />
            <Route path="/activity/:id" element={<ActivityDetail activities={activities} onRegister={handleRegister} registrations={registrations} />} />
            <Route path="/admin/login" element={
              currentUser ? <Navigate to="/admin" /> : <LoginPage users={users} onLogin={handleLogin} />
            } />
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