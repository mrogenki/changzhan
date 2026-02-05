
import React, { useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, LogOut, ChevronRight, Search, FileDown, Plus, Edit, Trash2, CheckCircle, XCircle, Shield, UserPlus, DollarSign, TrendingUp, BarChart3, Mail, User, Clock } from 'lucide-react';
import { Activity, Registration, ActivityType, AdminUser, UserRole } from '../types';

interface AdminDashboardProps {
  currentUser: AdminUser;
  onLogout: () => void;
  activities: Activity[];
  registrations: Registration[];
  users: AdminUser[];
  onUpdateActivity: (act: Activity) => void;
  onAddActivity: (act: Activity) => void;
  onDeleteActivity: (id: string) => void;
  onUpdateRegistration: (reg: Registration) => void;
  onDeleteRegistration: (id: string) => void;
  onAddUser: (user: AdminUser) => void;
  onDeleteUser: (id: string) => void;
}

const Sidebar: React.FC<{ user: AdminUser; onLogout: () => void }> = ({ user, onLogout }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const canAccessActivities = user.role === UserRole.MANAGER || user.role === UserRole.SUPER_ADMIN;
  const canAccessUsers = user.role === UserRole.SUPER_ADMIN;

  return (
    <div className="w-64 bg-gray-900 text-gray-400 flex flex-col min-h-screen">
      <div className="p-6 border-b border-gray-800">
        <Link to="/" className="flex items-center gap-3 text-white">
          <div className="w-8 h-8 bg-red-600 rounded-md flex items-center justify-center text-white font-bold">長</div>
          <span className="font-bold tracking-tight">管理系統</span>
        </Link>
        <div className="mt-4 px-3 py-2 rounded bg-gray-800 border border-gray-700">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{user.role}</p>
          <p className="text-sm text-white font-medium truncate">{user.name}</p>
        </div>
      </div>
      <nav className="flex-grow p-4 space-y-2">
        <Link to="/admin" className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive('/admin') ? 'bg-red-600 text-white' : 'hover:bg-gray-800'}`}>
          <LayoutDashboard size={20} />
          <span>儀表板</span>
        </Link>
        <Link to="/admin/check-in" className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${location.pathname.startsWith('/admin/check-in') ? 'bg-red-600 text-white' : 'hover:bg-gray-800'}`}>
          <Users size={20} />
          <span>報到管理</span>
        </Link>
        
        {canAccessActivities && (
          <Link to="/admin/activities" className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${location.pathname.startsWith('/admin/activities') ? 'bg-red-600 text-white' : 'hover:bg-gray-800'}`}>
            <Calendar size={20} />
            <span>活動管理</span>
          </Link>
        )}

        {canAccessUsers && (
          <Link to="/admin/users" className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${location.pathname.startsWith('/admin/users') ? 'bg-red-600 text-white' : 'hover:bg-gray-800'}`}>
            <Shield size={20} />
            <span>人員權限</span>
          </Link>
        )}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <button onClick={onLogout} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-600/10 hover:text-red-500 transition-colors">
          <LogOut size={20} />
          <span>登出</span>
        </button>
      </div>
    </div>
  );
};

const UserManager: React.FC<{ users: AdminUser[], onAddUser: (u: AdminUser) => void, onDeleteUser: (id: string) => void, currentUser: AdminUser }> = ({ users, onAddUser, onDeleteUser, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: UserRole.STAFF });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: AdminUser = {
      id: Math.random().toString(36).substr(2, 9),
      ...formData
    };
    onAddUser(newUser);
    setIsModalOpen(false);
    setFormData({ name: '', email: '', password: '', role: UserRole.STAFF });
  };

  const confirmDelete = (user: AdminUser) => {
    if (window.confirm(`確定要移除管理員「${user.name}」嗎？此動作無法復原。`)) {
      onDeleteUser(user.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">人員權限管理</h1>
          <p className="text-gray-500 text-sm">管理能存取此後台系統的管理人員。</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl hover:bg-red-700 transition-all shadow-md active:scale-95">
          <UserPlus size={18} />
          新增管理員
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              <th className="px-6 py-4">人員名稱</th>
              <th className="px-6 py-4">電子郵件</th>
              <th className="px-6 py-4">權限等級</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold">
                      {user.name.charAt(0)}
                    </div>
                    <span className="font-bold text-gray-900">{user.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500 text-sm">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                    user.role === UserRole.SUPER_ADMIN ? 'bg-purple-100 text-purple-700' :
                    user.role === UserRole.MANAGER ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {user.id !== currentUser.id ? (
                    <button onClick={() => confirmDelete(user)} className="text-gray-300 hover:text-red-600 p-2 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  ) : (
                    <span className="text-xs text-gray-300 font-medium px-2">當前帳號</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">新增管理人員</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <User size={14} className="text-red-600" /> 姓名
                </label>
                <input 
                  required 
                  className="w-full border-gray-200 border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500 transition-all"
                  placeholder="輸入管理員真實姓名"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Mail size={14} className="text-red-600" /> 電子郵件 (登入帳號)
                </label>
                <input 
                  type="email" 
                  required 
                  className="w-full border-gray-200 border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500 transition-all"
                  placeholder="example@changzhan.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">登入密碼</label>
                <input 
                  type="password" 
                  required 
                  className="w-full border-gray-200 border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500 transition-all"
                  placeholder="請設定初始密碼"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">權限設定</label>
                <select 
                  className="w-full border-gray-200 border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500 bg-white"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                >
                  <option value={UserRole.STAFF}>工作人員 (僅限報到)</option>
                  <option value={UserRole.MANAGER}>管理員 (報到+活動編輯)</option>
                  <option value={UserRole.SUPER_ADMIN}>總管理員 (完整權限)</option>
                </select>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 border border-gray-200 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50">取消</button>
                <button type="submit" className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-100 hover:bg-red-700 active:scale-95 transition-all">確認新增</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const DashboardHome: React.FC<{ activities: Activity[], registrations: Registration[] }> = ({ activities, registrations }) => {
  const activityStats = activities.map(activity => {
    const activityRegs = registrations.filter(r => r.activityId === activity.id);
    const checkedIn = activityRegs.filter(r => r.checkInStatus).length;
    const revenue = activityRegs.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
    const rate = activityRegs.length > 0 ? Math.round((checkedIn / activityRegs.length) * 100) : 0;
    
    return {
      ...activity,
      regCount: activityRegs.length,
      checkedInCount: checkedIn,
      checkInRate: rate,
      revenue
    };
  });

  return (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold">活動數據儀表板</h1>
          <p className="text-gray-500">掌握各場活動的報名與收益狀況。</p>
        </div>
        <div className="hidden md:block">
          <div className="flex items-center gap-2 text-sm text-gray-400 bg-white px-4 py-2 rounded-lg border border-gray-100">
            <BarChart3 size={16} />
            最後更新：{new Date().toLocaleTimeString()}
          </div>
        </div>
      </header>

      <section className="space-y-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-8 py-6 w-1/3">活動名稱 / 時間</th>
                  <th className="px-6 py-6">報名人數</th>
                  <th className="px-6 py-6">實收金額</th>
                  <th className="px-6 py-6">報到進度</th>
                  <th className="px-6 py-6">報到率</th>
                  <th className="px-8 py-6 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activityStats.map(stat => (
                  <tr key={stat.id} className="hover:bg-red-50/30 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="font-bold text-gray-900 text-lg">{stat.title}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-1 font-medium">
                        <Calendar size={12} className="text-red-600" />
                        {stat.date}
                        <Clock size={12} className="text-red-600 ml-2" />
                        {stat.time}
                        <span className="mx-1">•</span>
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500">{stat.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="text-2xl font-bold text-gray-800">{stat.regCount}</div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="text-xl font-bold text-red-600">NT$ {stat.revenue.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="text-lg font-bold text-gray-700">
                        {stat.checkedInCount} <span className="text-gray-300 font-normal">/</span> {stat.regCount}
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className={`text-xl font-black ${stat.checkInRate > 80 ? 'text-green-600' : stat.checkInRate > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                        {stat.checkInRate}%
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <Link 
                        to="/admin/check-in" 
                        state={{ activityId: stat.id }}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-400 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                      >
                        <ChevronRight size={20} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

const ActivityManager: React.FC<{ activities: Activity[], onAddActivity: (a: Activity) => void, onUpdateActivity: (a: Activity) => void, onDeleteActivity: (id: string) => void }> = ({ activities, onAddActivity, onUpdateActivity, onDeleteActivity }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const activityData: Activity = {
      id: editingActivity?.id || Math.random().toString(36).substr(2, 9),
      type: formData.get('type') as ActivityType,
      title: formData.get('title') as string,
      date: formData.get('date') as string,
      time: formData.get('time') as string,
      location: formData.get('location') as string,
      cost: Number(formData.get('cost')),
      image: formData.get('image') as string || 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=2069&auto=format&fit=crop',
      description: formData.get('description') as string,
      status: 'active'
    };
    if (editingActivity) onUpdateActivity(activityData);
    else onAddActivity(activityData);
    setIsModalOpen(false);
    setEditingActivity(null);
  };

  return (
    <div className="space-y-6 text-gray-900">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">活動管理</h1>
        <button onClick={() => { setEditingActivity(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg">
          <Plus size={18} /> 新增活動
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {activities.map(act => (
          <div key={act.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex">
            <img src={act.image} className="w-32 object-cover" alt={act.title} />
            <div className="p-4 flex-grow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">{act.type}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingActivity(act); setIsModalOpen(true); }} className="text-gray-400 hover:text-red-600"><Edit size={16} /></button>
                  <button onClick={() => onDeleteActivity(act.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              </div>
              <h3 className="font-bold line-clamp-1">{act.title}</h3>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1 font-medium">
                <Calendar size={12} className="text-red-600" /> {act.date} 
                <Clock size={12} className="ml-1 text-red-600" /> {act.time}
              </p>
            </div>
          </div>
        ))}
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold mb-4">{editingActivity ? '修改活動' : '新增活動'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">活動類型</label>
                <select name="type" defaultValue={editingActivity?.type} className="w-full border rounded-lg px-3 py-2 bg-white">
                  <option value={ActivityType.REGULAR}>例會</option>
                  <option value={ActivityType.SPECIAL}>精選活動</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">活動標題</label>
                <input name="title" required defaultValue={editingActivity?.title} className="w-full border rounded-lg px-3 py-2" placeholder="活動標題" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">日期</label>
                  <input type="date" name="date" required defaultValue={editingActivity?.date} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
                    <Clock size={14} className="text-red-600" /> 時間 (24小時制)
                  </label>
                  <input 
                    type="text" 
                    name="time" 
                    required 
                    defaultValue={editingActivity?.time} 
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 outline-none" 
                    placeholder="HH:mm (例如 18:30)"
                    pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]"
                    title="請使用 24 小時制格式 (HH:mm)，例如 06:30 或 18:30"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 font-bold italic">※ 例如 18:30 (勿使用上下午)</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">費用 (NT$)</label>
                  <input name="cost" type="number" required defaultValue={editingActivity?.cost} className="w-full border rounded-lg px-3 py-2" placeholder="費用" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">封面圖片網址</label>
                  <input name="image" defaultValue={editingActivity?.image} className="w-full border rounded-lg px-3 py-2" placeholder="https://..." />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">活動地點</label>
                <input name="location" required defaultValue={editingActivity?.location} className="w-full border rounded-lg px-3 py-2" placeholder="活動地點" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">活動描述</label>
                <textarea name="description" rows={4} required defaultValue={editingActivity?.description} className="w-full border rounded-lg px-3 py-2" placeholder="活動描述"></textarea>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 border py-3 rounded-lg font-bold text-gray-500 hover:bg-gray-50 transition-colors">取消</button>
                <button type="submit" className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold shadow-lg shadow-red-100 hover:bg-red-700 active:scale-95 transition-all">儲存活動</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const CheckInManager: React.FC<{ activities: Activity[], registrations: Registration[], onUpdateRegistration: (r: Registration) => void, onDeleteRegistration: (id: string) => void }> = ({ activities, registrations, onUpdateRegistration, onDeleteRegistration }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('all');
  const filteredRegistrations = registrations.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.phone.includes(searchTerm);
    const matchesActivity = selectedActivity === 'all' || r.activityId === selectedActivity;
    return matchesSearch && matchesActivity;
  });

  return (
    <div className="space-y-6 text-gray-900">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">報到管理</h1>
        <button onClick={() => {}} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all hover:bg-green-700 active:scale-95"><FileDown size={18}/> 匯出報名表</button>
      </div>
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <input type="text" placeholder="搜尋姓名或電話..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none" />
          <select value={selectedActivity} onChange={e => setSelectedActivity(e.target.value)} className="border rounded-lg px-4 py-2 bg-white outline-none focus:ring-2 focus:ring-red-500">
            <option value="all">所有活動</option>
            {activities.map(a => <option key={a.id} value={a.id}>{a.title} ({a.date})</option>)}
          </select>
        </div>
        <table className="w-full text-left">
          <thead className="border-b text-sm font-bold text-gray-400 uppercase">
            <tr><th className="pb-4">姓名 / 公司</th><th className="pb-4">繳費</th><th className="pb-4">狀態</th><th className="pb-4 text-right">操作</th></tr>
          </thead>
          <tbody className="divide-y">
            {filteredRegistrations.map(reg => (
              <tr key={reg.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-4">
                  <div className="font-bold">{reg.name}</div>
                  <div className="text-xs text-gray-400">{reg.company}</div>
                </td>
                <td className="py-4">
                  <input type="number" className="border rounded px-2 py-1 w-20 text-sm focus:ring-1 focus:ring-red-500 outline-none" value={reg.paidAmount || 0} onChange={(e) => onUpdateRegistration({...reg, paidAmount: parseInt(e.target.value)})} />
                </td>
                <td className="py-4">
                  <button onClick={() => onUpdateRegistration({...reg, checkInStatus: !reg.checkInStatus})} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${reg.checkInStatus ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                    {reg.checkInStatus ? '已報到' : '未報到'}
                  </button>
                </td>
                <td className="py-4 text-right"><button onClick={() => onDeleteRegistration(reg.id)} className="text-gray-300 hover:text-red-600 transition-colors"><Trash2 size={18}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  const canAccessActivities = props.currentUser.role === UserRole.MANAGER || props.currentUser.role === UserRole.SUPER_ADMIN;
  const canAccessUsers = props.currentUser.role === UserRole.SUPER_ADMIN;
  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar user={props.currentUser} onLogout={props.onLogout} />
      <div className="flex-grow p-8">
        <Routes>
          <Route path="/" element={<DashboardHome activities={props.activities} registrations={props.registrations} />} />
          <Route path="/check-in" element={<CheckInManager activities={props.activities} registrations={props.registrations} onUpdateRegistration={props.onUpdateRegistration} onDeleteRegistration={props.onDeleteRegistration} />} />
          {canAccessActivities && <Route path="/activities" element={<ActivityManager activities={props.activities} onAddActivity={props.onAddActivity} onUpdateActivity={props.onUpdateActivity} onDeleteActivity={props.onDeleteActivity} />} />}
          {canAccessUsers && <Route path="/users" element={<UserManager users={props.users} onAddUser={props.onAddUser} onDeleteUser={props.onDeleteUser} currentUser={props.currentUser} />} />}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default AdminDashboard;
