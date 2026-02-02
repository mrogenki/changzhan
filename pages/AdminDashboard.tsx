import React, { useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, LogOut, ChevronRight, Search, FileDown, Plus, Edit, Trash2, CheckCircle, XCircle, Shield, UserPlus, DollarSign, TrendingUp, BarChart3, Loader2 } from 'lucide-react';
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
  onAddUser: (user: AdminUser) => Promise<boolean>;
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
        <div className="mt-4 px-2 py-1 rounded bg-gray-800 border border-gray-700">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{user.role}</p>
          <p className="text-sm text-white font-medium truncate">{user.username}</p>
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
      <div className="p-4 border-t border-gray-800 space-y-2">
        <button onClick={onLogout} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-600/10 hover:text-red-500 transition-colors">
          <LogOut size={20} />
          <span>登出</span>
        </button>
      </div>
    </div>
  );
};

const DashboardHome: React.FC<{ activities: Activity[], registrations: Registration[] }> = ({ activities, registrations }) => {
  // 計算每個活動的數據
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

      {/* 各活動數據明細表格 */}
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
                        <span className="mx-1">•</span>
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500">{stat.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="text-2xl font-bold text-gray-800">{stat.regCount}</div>
                      <div className="text-xs text-gray-400 font-bold uppercase tracking-tight">People</div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="text-xl font-bold text-red-600">NT$ {stat.revenue.toLocaleString()}</div>
                      <div className="text-xs text-red-300 font-bold uppercase tracking-tight">Total Income</div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="text-lg font-bold text-gray-700">
                        {stat.checkedInCount} <span className="text-gray-300 font-normal">/</span> {stat.regCount}
                      </div>
                      <div className="text-xs text-gray-400 font-bold uppercase tracking-tight">Checked In</div>
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
                {activityStats.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-gray-400">
                      <Calendar size={48} className="mx-auto mb-4 opacity-10" />
                      目前尚無活動數據
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 快捷操作區 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <Link to="/admin/check-in" className="group p-8 bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-xl hover:border-red-100 transition-all flex items-center justify-between">
            <div className="flex items-center gap-6">
               <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <Users size={28} />
               </div>
               <div>
                  <h3 className="text-xl font-bold">前往報到管理</h3>
                  <p className="text-gray-400 mt-1">手動報到或調整繳費金額</p>
               </div>
            </div>
            <ChevronRight className="text-gray-200 group-hover:text-red-600 transition-colors" />
         </Link>
         
         <Link to="/admin/activities" className="group p-8 bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-xl hover:border-red-100 transition-all flex items-center justify-between">
            <div className="flex items-center gap-6">
               <div className="w-14 h-14 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <Calendar size={28} />
               </div>
               <div>
                  <h3 className="text-xl font-bold">管理活動資訊</h3>
                  <p className="text-gray-400 mt-1">新增、修改或關閉活動</p>
               </div>
            </div>
            <ChevronRight className="text-gray-200 group-hover:text-red-600 transition-colors" />
         </Link>
      </div>
    </div>
  );
};

const UserManager: React.FC<{ users: AdminUser[], onAddUser: (u: AdminUser) => Promise<boolean>, onDeleteUser: (id: string) => void, currentUser: AdminUser }> = ({ users, onAddUser, onDeleteUser, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const newUser: AdminUser = {
      id: Math.random().toString(36).substr(2, 9),
      username: formData.get('username') as string,
      password: formData.get('password') as string,
      role: formData.get('role') as UserRole
    };
    
    const success = await onAddUser(newUser);
    setIsSubmitting(false);
    if (success) {
      setIsModalOpen(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (id === currentUser.id) {
      alert('您不能刪除目前的登入帳號。');
      return;
    }
    if (window.confirm(`確定要刪除管理員「${name}」嗎？`)) {
      onDeleteUser(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-gray-900">
        <h1 className="text-2xl font-bold">人員權限管理</h1>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
          <UserPlus size={18} />
          新增人員
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden text-gray-900">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-4">帳號名稱</th>
              <th className="px-6 py-4">權限級別</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-bold">{user.username}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    user.role === UserRole.SUPER_ADMIN ? 'bg-purple-100 text-purple-700' :
                    user.role === UserRole.MANAGER ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {user.id !== currentUser.id ? (
                    <button onClick={() => handleDelete(user.id, user.username)} className="text-gray-300 hover:text-red-600 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-gray-300 uppercase italic">Your Account</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center text-gray-900">
              <h2 className="text-xl font-bold">新增管理人員</h2>
              <button onClick={() => setIsModalOpen(false)}><XCircle className="text-gray-300 hover:text-gray-500 transition-colors" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-gray-900">
              <div>
                <label className="block text-sm font-bold mb-1">帳號名稱</label>
                <input name="username" required className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500 bg-white" placeholder="用於登入的名稱" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">登入密碼</label>
                <input name="password" type="password" required className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500 bg-white" placeholder="請設定 6 位以上密碼" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">分配權限</label>
                <select name="role" required className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500 bg-white">
                  <option value={UserRole.STAFF}>工作人員 (僅報到管理)</option>
                  <option value={UserRole.MANAGER}>管理員 (報到+活動管理)</option>
                  <option value={UserRole.SUPER_ADMIN}>總管理員 (全功能)</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 border py-2 rounded-lg font-bold">取消</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2">
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : '確認新增'}
                </button>
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
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.phone.includes(searchTerm) || r.company.toLowerCase().includes(searchTerm.toLowerCase()) || (r.referrer?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesActivity = selectedActivity === 'all' || r.activityId === selectedActivity;
    return matchesSearch && matchesActivity;
  });
  const handleExportCSV = () => {
    const headers = ['活動', '姓名', '電話', '信箱', '公司', '職務', '引薦人', '繳費金額', '報到狀態', '報名時間'];
    const rows = filteredRegistrations.map(r => {
      const activity = activities.find(a => a.id === r.activityId);
      return [activity?.title || '未知活動', r.name, r.phone, r.email, r.company, r.title, r.referrer || '', r.paidAmount || 0, r.checkInStatus ? '已報到' : '未報到', r.registeredAt];
    });
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `registration_data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const toggleCheckIn = (reg: Registration) => {
    onUpdateRegistration({ ...reg, checkInStatus: !reg.checkInStatus });
  };
  const handlePaidAmountChange = (reg: Registration, amount: string) => {
    const val = amount === '' ? 0 : parseInt(amount, 10);
    if (!isNaN(val)) {
      onUpdateRegistration({ ...reg, paidAmount: val });
    }
  };
  return (
    <div className="space-y-6 text-gray-900">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">報到管理</h1>
        <button onClick={handleExportCSV} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
          <FileDown size={18} />
          匯出 CSV (含實收金額)
        </button>
      </div>
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm text-gray-900">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="搜尋姓名、電話、引薦人..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white" />
          </div>
          <select value={selectedActivity} onChange={e => setSelectedActivity(e.target.value)} className="border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none bg-white">
            <option value="all">所有活動</option>
            {activities.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-sm font-bold text-gray-400 uppercase tracking-wider">
                <th className="pb-4">姓名 / 聯絡</th>
                <th className="pb-4">公司 / 職務</th>
                <th className="pb-4">引薦人</th>
                <th className="pb-4">繳費</th>
                <th className="pb-4">狀態</th>
                <th className="pb-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRegistrations.map(reg => (
                <tr key={reg.id} className="group hover:bg-gray-50 transition-colors">
                  <td className="py-4">
                    <div className="font-bold">{reg.name}</div>
                    <div className="text-xs text-gray-400">{reg.phone}</div>
                  </td>
                  <td className="py-4">
                    <div className="text-sm">{reg.company}</div>
                    <div className="text-xs text-gray-400">{reg.title}</div>
                  </td>
                  <td className="py-4">
                    <div className="text-sm font-medium text-red-600">{reg.referrer || '-'}</div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 w-24">
                      <span className="text-gray-400 text-xs">$</span>
                      <input type="number" className="bg-transparent w-full text-sm outline-none font-medium" value={reg.paidAmount ?? 0} onChange={(e) => handlePaidAmountChange(reg, e.target.value)} placeholder="0" />
                    </div>
                  </td>
                  <td className="py-4">
                    <button onClick={() => toggleCheckIn(reg)} className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${reg.checkInStatus ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {reg.checkInStatus ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {reg.checkInStatus ? '已報到' : '未報到'}
                    </button>
                  </td>
                  <td className="py-4 text-right">
                    <button onClick={() => onDeleteRegistration(reg.id)} className="text-gray-300 hover:text-red-600 p-2">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRegistrations.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">查無報名資料</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ActivityManager: React.FC<{ activities: Activity[], onAddActivity: (a: Activity) => void, onUpdateActivity: (a: Activity) => void, onDeleteActivity: (id: string) => void }> = ({ activities, onAddActivity, onUpdateActivity, onDeleteActivity }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  
  const handleDelete = (act: Activity) => {
    if (window.confirm(`確定要刪除活動「${act.title}」嗎？此動作將會連同報名資料一併移除且無法復原。`)) {
      onDeleteActivity(act.id);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rawDate = formData.get('date') as string;
    const formattedDate = rawDate.replace('T', ' ');
    const activityData: Activity = {
      id: editingActivity?.id || Math.random().toString(36).substr(2, 9),
      type: formData.get('type') as ActivityType,
      title: formData.get('title') as string,
      date: formattedDate,
      location: formData.get('location') as string,
      cost: Number(formData.get('cost')),
      image: formData.get('image') as string || 'https://picsum.photos/seed/default/800/400',
      description: formData.get('description') as string,
      status: 'active'
    };
    if (editingActivity) {
      onUpdateActivity(activityData);
    } else {
      onAddActivity(activityData);
    }
    setIsModalOpen(false);
    setEditingActivity(null);
  };

  const formatForInput = (dateStr?: string) => {
    if (!dateStr) return '';
    return dateStr.replace(' ', 'T');
  };

  return (
    <div className="space-y-6 text-gray-900">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">活動管理</h1>
        <button onClick={() => { setEditingActivity(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
          <Plus size={18} />
          新增活動
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {activities.map(act => (
          <div key={act.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex text-gray-900">
            <img src={act.image} className="w-32 object-cover" alt={act.title} />
            <div className="p-4 flex-grow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">{act.type}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingActivity(act); setIsModalOpen(true); }} className="text-gray-400 hover:text-red-600 transition-colors p-1">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleDelete(act)} className="text-gray-400 hover:text-red-600 transition-colors p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h3 className="font-bold line-clamp-1">{act.title}</h3>
              <p className="text-xs text-gray-400 mt-1">{act.date}</p>
            </div>
          </div>
        ))}
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center text-gray-900">
              <h2 className="text-xl font-bold">{editingActivity ? '修改活動' : '新增活動'}</h2>
              <button onClick={() => setIsModalOpen(false)}><XCircle className="text-gray-300 hover:text-gray-500 transition-colors" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-gray-900">
              <div>
                <label className="block text-sm font-bold mb-1">活動類型</label>
                <select name="type" defaultValue={editingActivity?.type || ActivityType.REGULAR} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500 bg-white">
                  <option value={ActivityType.REGULAR}>例會</option>
                  <option value={ActivityType.SPECIAL}>精選活動</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">標題</label>
                <input name="title" required defaultValue={editingActivity?.title} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500 bg-white" placeholder="活動標題" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">時間</label>
                  <input type="datetime-local" name="date" required defaultValue={formatForInput(editingActivity?.date)} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500 bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">費用</label>
                  <input name="cost" type="number" required defaultValue={editingActivity?.cost} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500 bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">地點</label>
                <input name="location" required defaultValue={editingActivity?.location} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500 bg-white" placeholder="活動地點" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">圖片 URL</label>
                <input name="image" placeholder="https://..." defaultValue={editingActivity?.image} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500 bg-white" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">活動描述</label>
                <textarea name="description" rows={4} required defaultValue={editingActivity?.description} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500 bg-white" placeholder="活動詳細說明"></textarea>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 border py-2 rounded-lg font-bold">取消</button>
                <button type="submit" className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold">儲存活動</button>
              </div>
            </form>
          </div>
        </div>
      )}
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
          <Route path="/check-in" element={
            <CheckInManager 
              activities={props.activities} 
              registrations={props.registrations} 
              onUpdateRegistration={props.onUpdateRegistration}
              onDeleteRegistration={props.onDeleteRegistration}
            />
          } />
          {canAccessActivities && (
            <Route path="/activities" element={
              <ActivityManager 
                activities={props.activities} 
                onAddActivity={props.onAddActivity}
                onUpdateActivity={props.onUpdateActivity}
                onDeleteActivity={props.onDeleteActivity}
              />
            } />
          )}
          {canAccessUsers && (
            <Route path="/users" element={
              <UserManager 
                users={props.users} 
                onAddUser={props.onAddUser} 
                onDeleteUser={props.onDeleteUser}
                currentUser={props.currentUser}
              />
            } />
          )}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default AdminDashboard;