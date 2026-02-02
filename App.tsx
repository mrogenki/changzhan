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

// 初始化 Supabase
const supabaseUrl = 'https://qxoglhkfxxqsjefynzqn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4b2dsaGtmeHhxc2plZnluenFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzQwNTAsImV4cCI6MjA4NTYxMDA1MH0.gLvcHgY0rqLd26Nw61_M7nmjaz4TUsP9VL-XxN5wNSU';
const supabase = createClient(supabaseUrl, supabaseKey);

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
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    const saved = sessionStorage.getItem('current_user');
    return saved ? JSON.parse(saved) : null;
  });

  // 從 Supabase 讀取所有資料
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: actData } = await supabase.from('activities').select('*').order('date', { ascending: true });
      const { data: regData } = await supabase.from('registrations').select('*').order('registeredAt', { ascending: false });
      const { data: userData } = await supabase.from('admin_users').select('*');

      if (actData && actData.length > 0) setActivities(actData);
      else {
        // 如果是空的，填入初始資料
        await supabase.from('activities').insert(INITIAL_ACTIVITIES);
        setActivities(INITIAL_ACTIVITIES);
      }

      if (regData) setRegistrations(regData);
      
      if (userData && userData.length > 0) setUsers(userData);
      else {
        await supabase.from('admin_users').insert(INITIAL_ADMINS);
        setUsers(INITIAL_ADMINS);
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

  // 報名功能
  const handleRegister = async (newReg: Registration) => {
    const { error } = await supabase.from('registrations').insert([newReg]);
    if (!error) {
      setRegistrations(prev => [newReg, ...prev]);
    }
  };

  // 活動管理功能
  const handleUpdateActivity = async (updated: Activity) => {
    const { error } = await supabase.from('activities').update(updated).eq('id', updated.id);
    if (!error) {
      setActivities(prev => prev.map(a => a.id === updated.id ? updated : a));
    }
  };

  const handleAddActivity = async (newAct: Activity) => {
    const { error } = await supabase.from('activities').insert([newAct]);
    if (!error) {
      setActivities(prev => [...prev, newAct]);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    const { error: regError } = await supabase.from('registrations').delete().eq('activityId', id);
    const { error: actError } = await supabase.from('activities').delete().eq('id', id);
    if (!actError) {
      setActivities(prev => prev.filter(a => a.id !== id));
      setRegistrations(prev => prev.filter(r => r.activityId !== id));
    }
  };

  // 報到與報名管理
  const handleDeleteRegistration = async (id: string) => {
    const { error } = await supabase.from('registrations').delete().eq('id', id);
    if (!error) {
      setRegistrations(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleUpdateRegistration = async (updated: Registration) => {
    const { error } = await supabase.from('registrations').update(updated).eq('id', updated.id);
    if (!error) {
      setRegistrations(prev => prev.map(r => r.id === updated.id ? updated : r));
    }
  };

  // 用戶權限管理
  const handleAddUser = async (newUser: AdminUser) => {
    const { error } = await supabase.from('admin_users').insert([newUser]);
    if (!error) {
      setUsers(prev => [...prev, newUser]);
    }
  };

  const handleDeleteUser = async (id: string) => {
    const { error } = await supabase.from('admin_users').delete().eq('id', id);
    if (!error) {
      setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin mx-auto text-red-600" size={48} />
          <p className="text-gray-500 font-medium">正在連接雲端資料庫...</p>
        </div>
      </div>
    );
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