
import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, LogOut, ChevronRight, Search, FileDown, Plus, Edit, Trash2, CheckCircle, XCircle, Shield, UserPlus, DollarSign, TrendingUp, BarChart3, Mail, User, Clock, Image as ImageIcon, UploadCloud, Loader2, Smartphone, Building2, Briefcase, Globe, FileUp, Download, ClipboardList, CheckSquare, AlertCircle, RotateCcw, MapPin } from 'lucide-react';
import { Activity, Registration, ActivityType, AdminUser, UserRole, Member, AttendanceRecord, AttendanceStatus } from '../types';

interface AdminDashboardProps {
  currentUser: AdminUser;
  onLogout: () => void;
  activities: Activity[];
  registrations: Registration[];
  users: AdminUser[];
  members: Member[];
  attendance: AttendanceRecord[]; 
  onUpdateActivity: (act: Activity) => void;
  onAddActivity: (act: Activity) => void;
  onDeleteActivity: (id: string | number) => void;
  onUpdateRegistration: (reg: Registration) => void;
  onDeleteRegistration: (id: string | number) => void;
  onAddUser: (user: AdminUser) => void;
  onDeleteUser: (id: string) => void;
  onAddMember: (member: Member) => void;
  onAddMembers?: (members: Member[]) => void;
  onUpdateMember: (member: Member) => void;
  onDeleteMember: (id: string | number) => void;
  onUpdateAttendance: (activityId: string, memberId: string, status: AttendanceStatus) => void; 
  onDeleteAttendance: (activityId: string, memberId: string) => void; 
  onUploadImage: (file: File) => Promise<string>;
}

// 獨立的輸入元件：解決輸入時頻繁更新導致卡頓的問題
const PaidAmountInput: React.FC<{ value?: number; onSave: (val: number) => void }> = ({ value, onSave }) => {
  const [localValue, setLocalValue] = useState(value?.toString() || '0');

  useEffect(() => {
    setLocalValue(value?.toString() || '0');
  }, [value]);

  const handleBlur = () => {
    const num = parseInt(localValue);
    if (!isNaN(num) && num !== (value || 0)) {
      onSave(num);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="number"
      className="border rounded px-2 py-1 w-24 text-sm focus:ring-1 focus:ring-red-500 outline-none transition-all text-right"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="0"
    />
  );
};

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
          <span>報到管理 (訪客)</span>
        </Link>
        
        {/* 新增：會員報到，所有後台權限皆可看 */}
        <Link to="/admin/attendance" className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${location.pathname.startsWith('/admin/attendance') ? 'bg-red-600 text-white' : 'hover:bg-gray-800'}`}>
          <ClipboardList size={20} />
          <span>會員報到 (例會)</span>
        </Link>
        
        {canAccessActivities && (
          <>
            <Link to="/admin/activities" className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${location.pathname.startsWith('/admin/activities') ? 'bg-red-600 text-white' : 'hover:bg-gray-800'}`}>
              <Calendar size={20} />
              <span>活動管理</span>
            </Link>
            <Link to="/admin/members" className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${location.pathname.startsWith('/admin/members') ? 'bg-red-600 text-white' : 'hover:bg-gray-800'}`}>
              <Building2 size={20} />
              <span>會員管理</span>
            </Link>
          </>
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

const DashboardHome: React.FC<{ activities: Activity[]; registrations: Registration[] }> = ({ activities, registrations }) => {
  // 計算活動統計資料
  const activityStats = activities.map(activity => {
    const activityRegs = registrations.filter(r => String(r.activityId) === String(activity.id));
    const checkedIn = activityRegs.filter(r => r.check_in_status === true).length; 
    const revenue = activityRegs.reduce((sum, r) => sum + (r.paid_amount || 0), 0);
    const rate = activityRegs.length > 0 ? Math.round((checkedIn / activityRegs.length) * 100) : 0;
    
    return {
      ...activity,
      regCount: activityRegs.length,
      checkedInCount: checkedIn,
      checkInRate: rate,
      revenue
    };
  });

  const activeActivities = activities.filter(a => !a.status || a.status === 'active');
  const totalRevenue = registrations.reduce((sum, reg) => sum + (reg.paid_amount || 0), 0);
  const checkedInCount = registrations.filter(r => r.check_in_status).length;

  const handleSingleExport = (activity: Activity) => {
    const targetRegs = registrations.filter(r => String(r.activityId) === String(activity.id));
    if (targetRegs.length === 0) {
      alert(`「${activity.title}」目前尚無報名資料，無法匯出。`);
      return;
    }
    let csvContent = '\uFEFF';
    const headers = ['活動名稱', '日期', '姓名', '電話', 'Email', '公司', '職稱', '引薦人', '繳費金額', '報到狀態', '報名時間'];
    csvContent += headers.join(',') + '\n';
    targetRegs.forEach(reg => {
      const checkIn = reg.check_in_status ? '已報到' : '未報到';
      const paid = reg.paid_amount || 0;
      const regTime = new Date(reg.created_at).toLocaleString('zh-TW');
      const escape = (text: string | undefined) => {
        if (!text) return '""';
        return `"${text.replace(/"/g, '""')}"`;
      };
      const row = [
        escape(activity.title),
        escape(activity.date),
        escape(reg.name),
        escape(reg.phone),
        escape(reg.email),
        escape(reg.company),
        escape(reg.title),
        escape(reg.referrer),
        paid,
        escape(checkIn),
        escape(regTime)
      ];
      csvContent += row.join(',') + '\n';
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activity.date}_${activity.title}_報名名單.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">活動數據儀表板</h1>
          <p className="text-gray-500">掌握各場活動的報名與收益狀況。</p>
        </div>
      </header>

      {/* 總覽卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">總活動場次</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">{activeActivities.length}</h3>
            </div>
            <div className="p-3 bg-red-50 text-red-600 rounded-xl"><Calendar size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">總報名人數</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">{registrations.length}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">總報到人數</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">{checkedInCount}</h3>
            </div>
            <div className="p-3 bg-green-50 text-green-600 rounded-xl"><CheckCircle size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">總營收 (已繳費)</p>
               <h3 className="text-3xl font-bold text-gray-900 mt-2">NT$ {totalRevenue.toLocaleString()}</h3>
             </div>
             <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl"><DollarSign size={24} /></div>
           </div>
        </div>
      </div>

      {/* 活動列表與詳細數據 */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-gray-800">各活動報名狀況</h2>
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
                      <div className="flex justify-end items-center gap-2">
                        <button 
                          onClick={() => handleSingleExport(stat)}
                          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-all shadow-sm"
                          title="匯出此活動報名表"
                        >
                          <FileDown size={20} />
                        </button>
                        <Link 
                          to="/admin/check-in" 
                          state={{ activityId: stat.id }}
                          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-400 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                          title="進入報到管理"
                        >
                          <ChevronRight size={20} />
                        </Link>
                      </div>
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

const CheckInManager: React.FC<{ 
  activities: Activity[]; 
  registrations: Registration[]; 
  onUpdateRegistration: (reg: Registration) => void; 
  onDeleteRegistration: (id: string | number) => void;
}> = ({ activities, registrations, onUpdateRegistration, onDeleteRegistration }) => {
  const [selectedActivityId, setSelectedActivityId] = useState<string>(activities.length > 0 ? String(activities[0].id) : '');
  const [searchTerm, setSearchTerm] = useState('');

  // Update selectedActivityId when activities change if it's empty
  useEffect(() => {
    if (!selectedActivityId && activities.length > 0) {
      setSelectedActivityId(String(activities[0].id));
    }
  }, [activities]);

  const filteredRegistrations = registrations.filter(r => {
    const matchesActivity = selectedActivityId === 'all' || String(r.activityId) === selectedActivityId;
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.phone.includes(searchTerm) ||
                          r.company?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesActivity && matchesSearch;
  });

  const handleExport = () => {
    if (filteredRegistrations.length === 0) {
      alert('目前列表無資料可匯出');
      return;
    }
    let csvContent = '\uFEFF';
    const headers = ['活動名稱', '日期', '姓名', '電話', 'Email', '公司', '職稱', '引薦人', '繳費金額', '報到狀態', '報名時間'];
    csvContent += headers.join(',') + '\n';

    filteredRegistrations.forEach(reg => {
      const activity = activities.find(a => String(a.id) === String(reg.activityId));
      const actTitle = activity ? activity.title : '未知活動';
      const actDate = activity ? activity.date : '';
      const checkIn = reg.check_in_status ? '已報到' : '未報到';
      const paid = reg.paid_amount || 0;
      const regTime = new Date(reg.created_at).toLocaleString('zh-TW');

      const escape = (text: string | undefined) => {
        if (!text) return '""';
        return `"${text.replace(/"/g, '""')}"`;
      };

      const row = [
        escape(actTitle),
        escape(actDate),
        escape(reg.name),
        escape(reg.phone),
        escape(reg.email),
        escape(reg.company),
        escape(reg.title),
        escape(reg.referrer),
        paid,
        escape(checkIn),
        escape(regTime)
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    let filename = '活動報名名單.csv';
    if (selectedActivityId !== 'all') {
      const act = activities.find(a => String(a.id) === String(selectedActivityId));
      if (act) {
        filename = `${act.date}_${act.title}_報名名單.csv`;
      }
    } else {
      const dateStr = new Date().toISOString().split('T')[0];
      filename = `所有活動報名名單_${dateStr}.csv`;
    }
    
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold">報到管理 (訪客)</h1>
           <p className="text-gray-500 text-sm">管理活動報名人員的報到狀態與繳費紀錄。</p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button 
            onClick={handleExport} 
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-xl hover:bg-green-700 transition-all shadow-sm active:scale-95 whitespace-nowrap"
          >
            <FileDown size={18}/> 匯出報名表
          </button>
          <select 
            value={selectedActivityId} 
            onChange={e => setSelectedActivityId(e.target.value)} 
            className="w-full md:w-64 border rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-red-500 font-bold"
          >
            <option value="all">所有活動</option>
            {activities.map(a => (
              <option key={a.id} value={a.id}>{a.date} {a.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Search size={18} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="搜尋姓名、電話或公司..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="bg-transparent outline-none text-sm w-full sm:w-64"
            />
          </div>
          <div className="flex gap-4 text-sm font-bold text-gray-500">
             <span>報名：{filteredRegistrations.length}</span>
             <span className="text-green-600">已報到：{filteredRegistrations.filter(r => r.check_in_status).length}</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">姓名 / 公司</th>
                <th className="px-6 py-4">聯絡資訊</th>
                <th className="px-6 py-4">報到狀態</th>
                <th className="px-6 py-4">繳費金額</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRegistrations.map(reg => (
                <tr key={reg.id} className={`hover:bg-gray-50/50 transition-colors ${reg.check_in_status ? 'bg-green-50/10' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{reg.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{reg.company} {reg.title && ` - ${reg.title}`}</div>
                    {reg.referrer && <div className="text-xs text-red-400 mt-1">引薦人: {reg.referrer}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-mono text-gray-600">{reg.phone}</div>
                    <div className="text-xs text-gray-400">{reg.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => onUpdateRegistration({...reg, check_in_status: !reg.check_in_status})}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        reg.check_in_status 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {reg.check_in_status ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {reg.check_in_status ? '已報到' : '未報到'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">$</span>
                      <PaidAmountInput 
                        value={reg.paid_amount} 
                        onSave={(val) => onUpdateRegistration({...reg, paid_amount: val})} 
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => { if(window.confirm('確定要刪除此報名紀錄嗎？')) onDeleteRegistration(reg.id); }}
                      className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRegistrations.length === 0 && (
             <div className="p-10 text-center text-gray-400">目前尚無報名資料</div>
          )}
        </div>
      </div>
    </div>
  );
};

const ActivityManager: React.FC<{ 
  activities: Activity[]; 
  onAddActivity: (act: Activity) => void; 
  onUpdateActivity: (act: Activity) => void; 
  onDeleteActivity: (id: string | number) => void;
  onUploadImage: (file: File) => Promise<string>;
}> = ({ activities, onAddActivity, onUpdateActivity, onDeleteActivity, onUploadImage }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Default form state
  const defaultFormState = {
    title: '',
    type: ActivityType.REGULAR,
    date: '',
    time: '06:30',
    location: '台北市大安區忠孝東路四段 218 號 (阿波羅大廈)',
    price: 500,
    picture: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=2069&auto=format&fit=crop',
    description: ''
  };

  const [formData, setFormData] = useState(defaultFormState);

  // Initialize form when opening modal
  useEffect(() => {
    if (editingActivity) {
      setFormData({
        title: editingActivity.title,
        type: editingActivity.type,
        date: editingActivity.date,
        time: editingActivity.time,
        location: editingActivity.location,
        price: editingActivity.price,
        picture: editingActivity.picture,
        description: editingActivity.description
      });
    } else {
      setFormData(defaultFormState);
    }
  }, [editingActivity, isModalOpen]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const url = await onUploadImage(file);
        setFormData(prev => ({ ...prev, picture: url }));
      } catch (error) {
        alert('圖片上傳失敗');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const activityData: Activity = {
      id: editingActivity ? editingActivity.id : Date.now().toString(),
      ...formData,
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">活動管理</h1>
        <button 
          onClick={() => { setEditingActivity(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-sm"
        >
          <Plus size={18} /> 新增活動
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activities.map(activity => (
          <div key={activity.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-lg transition-all">
            <div className="relative h-40">
              <img src={activity.picture} alt={activity.title} className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 flex gap-1">
                <button 
                  onClick={() => { setEditingActivity(activity); setIsModalOpen(true); }}
                  className="p-2 bg-white/90 rounded-lg text-gray-700 hover:text-blue-600 backdrop-blur-sm"
                >
                  <Edit size={16} />
                </button>
                <button 
                  onClick={() => { if(window.confirm('確定要刪除此活動嗎？')) onDeleteActivity(activity.id); }}
                  className="p-2 bg-white/90 rounded-lg text-gray-700 hover:text-red-600 backdrop-blur-sm"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="absolute bottom-2 left-2">
                 <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                    activity.type === ActivityType.REGULAR ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'
                 }`}>
                   {activity.type}
                 </span>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 text-xs text-gray-400 font-bold mb-2">
                <Calendar size={12} /> {activity.date}
                <Clock size={12} /> {activity.time}
              </div>
              <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">{activity.title}</h3>
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-4">
                <MapPin size={12} /> <span className="line-clamp-1">{activity.location}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                 <span className="font-bold text-red-600">NT$ {activity.price}</span>
                 <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activity.status === 'closed' ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-600'}`}>
                   {activity.status === 'closed' ? '已結束' : '進行中'}
                 </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">{editingActivity ? '編輯活動' : '新增活動'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">活動標題</label>
                  <input 
                    required 
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" 
                    placeholder="活動名稱" 
                  />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">活動類型</label>
                   <select 
                     value={formData.type}
                     onChange={e => setFormData({...formData, type: e.target.value as ActivityType})}
                     className="w-full border rounded-lg px-3 py-3 bg-white outline-none focus:ring-2 focus:ring-red-500"
                   >
                     <option value={ActivityType.REGULAR}>例會</option>
                     <option value={ActivityType.SPECIAL}>精選活動</option>
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">報名費用</label>
                   <input 
                    required 
                    type="number"
                    value={formData.price} 
                    onChange={e => setFormData({...formData, price: parseInt(e.target.value)})}
                    className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" 
                    placeholder="500" 
                  />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">活動日期</label>
                   <input 
                    required 
                    type="date"
                    value={formData.date} 
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" 
                  />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">活動時間</label>
                   <input 
                    required 
                    type="time"
                    value={formData.time} 
                    onChange={e => setFormData({...formData, time: e.target.value})}
                    className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">活動地點</label>
                  <input 
                    required 
                    value={formData.location} 
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" 
                    placeholder="地址" 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">活動圖片</label>
                  <div className="flex gap-4 items-start">
                    <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                      {formData.picture ? <img src={formData.picture} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon className="w-full h-full p-6 text-gray-300" />}
                    </div>
                    <div className="flex-grow space-y-3">
                       <div className="relative">
                         <input 
                           type="file" 
                           accept="image/*"
                           onChange={handleImageChange}
                           className="hidden"
                           id="upload-image"
                         />
                         <label 
                           htmlFor="upload-image" 
                           className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors ${isUploading ? 'bg-gray-100 text-gray-400 cursor-wait' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                         >
                           {isUploading ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
                           {isUploading ? '上傳中...' : '上傳圖片'}
                         </label>
                       </div>
                       <input 
                          value={formData.picture} 
                          onChange={e => setFormData({...formData, picture: e.target.value})}
                          className="w-full border rounded-lg px-3 py-2 text-xs text-gray-500 outline-none focus:ring-2 focus:ring-red-500" 
                          placeholder="或貼上圖片 URL" 
                        />
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">活動說明</label>
                  <textarea 
                    rows={4}
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500 resize-none" 
                    placeholder="活動詳細內容..." 
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4 border-t border-gray-100 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 border py-3 rounded-lg font-bold text-gray-500 hover:bg-gray-50 transition-colors">取消</button>
                <button type="submit" disabled={isUploading} className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold shadow-lg shadow-red-100 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50">
                   {editingActivity ? '更新活動' : '建立活動'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// 新增：會員出席管理元件
const MemberAttendanceManager: React.FC<{
  activities: Activity[],
  members: Member[],
  attendance: AttendanceRecord[],
  onUpdateAttendance: (actId: string, memId: string, status: AttendanceStatus) => void,
  onDeleteAttendance: (actId: string, memId: string) => void
}> = ({ activities, members, attendance, onUpdateAttendance, onDeleteAttendance }) => {
  // 只篩選出 "例會"
  const regularActivities = activities.filter(a => a.type === ActivityType.REGULAR);
  
  // 找出最近的一場未過期或今天剛過的例會作為預設值
  const defaultActivityId = React.useMemo(() => {
    if (regularActivities.length === 0) return '';
    const now = new Date();
    // 簡單排序：找日期最接近今天的
    const sorted = [...regularActivities].sort((a, b) => {
       const da = new Date(a.date).getTime();
       const db = new Date(b.date).getTime();
       return Math.abs(da - now.getTime()) - Math.abs(db - now.getTime());
    });
    return String(sorted[0].id);
  }, [regularActivities]);

  const [selectedActivityId, setSelectedActivityId] = useState(defaultActivityId);
  const [searchTerm, setSearchTerm] = useState('');

  // 當 defaultActivityId 改變時（例如資料剛載入），更新選取狀態
  useEffect(() => {
    if (!selectedActivityId && defaultActivityId) {
      setSelectedActivityId(defaultActivityId);
    }
  }, [defaultActivityId]);

  // 排序會員
  const sortedMembers = [...members].sort((a, b) => {
    const valA = a.member_no !== undefined && a.member_no !== null ? String(a.member_no) : '';
    const valB = b.member_no !== undefined && b.member_no !== null ? String(b.member_no) : '';
    if (!valA && !valB) return 0;
    if (!valA) return 1;
    if (!valB) return -1;
    return valA.localeCompare(valB, undefined, { numeric: true });
  });

  const filteredMembers = sortedMembers.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.member_no && String(m.member_no).includes(searchTerm))
  );

  // 計算統計數據
  const stats = React.useMemo(() => {
    const records = attendance.filter(r => String(r.activity_id) === String(selectedActivityId));
    return {
      total: members.length,
      marked: records.length,
      present: records.filter(r => r.status === AttendanceStatus.PRESENT).length,
      absent: records.filter(r => r.status === AttendanceStatus.ABSENT).length,
      late: records.filter(r => r.status === AttendanceStatus.LATE).length,
      medical: records.filter(r => r.status === AttendanceStatus.MEDICAL).length,
      substitute: records.filter(r => r.status === AttendanceStatus.SUBSTITUTE).length,
    };
  }, [attendance, selectedActivityId, members.length]);

  const getMemberRecord = (memberId: string | number) => {
    return attendance.find(r => String(r.activity_id) === String(selectedActivityId) && String(r.member_id) === String(memberId));
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // 分類名單
  const listByStatus = (status: AttendanceStatus) => {
    const records = attendance.filter(r => String(r.activity_id) === String(selectedActivityId) && r.status === status);
    return records.map(r => {
      const member = members.find(m => String(m.id) === String(r.member_id));
      return { ...member, updated_at: r.updated_at };
    }).filter(item => item.id); // 過濾掉找不到會員的資料 (理論上不該發生)
  };

  const lateList = listByStatus(AttendanceStatus.LATE);
  const substituteList = listByStatus(AttendanceStatus.SUBSTITUTE);
  const medicalList = listByStatus(AttendanceStatus.MEDICAL);
  const absentList = listByStatus(AttendanceStatus.ABSENT);

  const statusOptions = [
    { value: AttendanceStatus.PRESENT, label: '出席', color: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200', activeColor: 'bg-green-600 text-white border-green-600' },
    { value: AttendanceStatus.LATE, label: '遲到', color: 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200', activeColor: 'bg-yellow-500 text-white border-yellow-500' },
    { value: AttendanceStatus.SUBSTITUTE, label: '代理', color: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200', activeColor: 'bg-purple-600 text-white border-purple-600' },
    { value: AttendanceStatus.MEDICAL, label: '病假', color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200', activeColor: 'bg-blue-600 text-white border-blue-600' },
    { value: AttendanceStatus.ABSENT, label: '缺席', color: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200', activeColor: 'bg-red-600 text-white border-red-600' },
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">會員報到 (例會)</h1>
          <p className="text-gray-500 text-sm">每週例會會員出席狀況記錄。</p>
        </div>
        <div className="w-full md:w-auto">
          <select 
            value={selectedActivityId} 
            onChange={e => setSelectedActivityId(e.target.value)} 
            className="w-full md:w-64 border rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-red-500 font-bold"
          >
            {regularActivities.length === 0 && <option value="">無例會活動</option>}
            {regularActivities.map(a => (
              <option key={a.id} value={a.id}>{a.date} {a.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
         <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
            <div className="text-xs text-gray-400 font-bold uppercase">總會員數</div>
            <div className="text-xl font-bold text-gray-800">{stats.total}</div>
         </div>
         <div className="bg-green-50 p-3 rounded-xl border border-green-100">
            <div className="text-xs text-green-600 font-bold uppercase">出席 (P)</div>
            <div className="text-xl font-bold text-green-700">{stats.present}</div>
         </div>
         <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
            <div className="text-xs text-yellow-600 font-bold uppercase">遲到 (L)</div>
            <div className="text-xl font-bold text-yellow-700">{stats.late}</div>
         </div>
         <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
            <div className="text-xs text-purple-600 font-bold uppercase">代理 (S)</div>
            <div className="text-xl font-bold text-purple-700">{stats.substitute}</div>
         </div>
         <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
            <div className="text-xs text-blue-600 font-bold uppercase">病假 (M)</div>
            <div className="text-xl font-bold text-blue-700">{stats.medical}</div>
         </div>
         <div className="bg-red-50 p-3 rounded-xl border border-red-100">
            <div className="text-xs text-red-600 font-bold uppercase">缺席 (A)</div>
            <div className="text-xl font-bold text-red-700">{stats.absent}</div>
         </div>
      </div>

      {/* 異常狀況清單列表 */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <AlertCircle size={20} className="text-red-600" />
          異常狀況與代理名單列表
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           {/* 遲到名單 */}
           <div className="bg-white rounded-xl border border-yellow-200 shadow-sm overflow-hidden">
             <div className="bg-yellow-50 px-4 py-3 border-b border-yellow-100 flex justify-between items-center">
               <h3 className="font-bold text-yellow-800 flex items-center gap-2"><Clock size={16}/> 遲到 ({lateList.length})</h3>
             </div>
             <div className="p-4 max-h-60 overflow-y-auto">
                {lateList.length === 0 ? <p className="text-gray-400 text-sm">無遲到人員</p> : (
                  <ul className="space-y-2">
                    {lateList.map((m: any) => (
                      <li key={m.id} className="text-sm font-bold text-gray-700 py-1 border-b border-yellow-100 last:border-0">
                        {m.name}
                      </li>
                    ))}
                  </ul>
                )}
             </div>
           </div>

           {/* 代理名單 */}
           <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden">
             <div className="bg-purple-50 px-4 py-3 border-b border-purple-100 flex justify-between items-center">
               <h3 className="font-bold text-purple-800 flex items-center gap-2"><User size={16}/> 代理 ({substituteList.length})</h3>
             </div>
             <div className="p-4 max-h-60 overflow-y-auto">
                {substituteList.length === 0 ? <p className="text-gray-400 text-sm">無代理人員</p> : (
                  <ul className="space-y-2">
                    {substituteList.map((m: any) => (
                      <li key={m.id} className="text-sm font-bold text-gray-700 py-1 border-b border-purple-100 last:border-0">
                        {m.name}
                      </li>
                    ))}
                  </ul>
                )}
             </div>
           </div>

           {/* 病假名單 */}
           <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
             <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
               <h3 className="font-bold text-blue-800 flex items-center gap-2"><ClipboardList size={16}/> 病假 ({medicalList.length})</h3>
             </div>
             <div className="p-4 max-h-60 overflow-y-auto">
                {medicalList.length === 0 ? <p className="text-gray-400 text-sm">無病假人員</p> : (
                  <ul className="space-y-2">
                    {medicalList.map((m: any) => (
                      <li key={m.id} className="text-sm font-bold text-gray-700 py-1 border-b border-blue-100 last:border-0">
                         {m.name}
                      </li>
                    ))}
                  </ul>
                )}
             </div>
           </div>

           {/* 缺席名單 */}
           <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
             <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex justify-between items-center">
               <h3 className="font-bold text-red-800 flex items-center gap-2"><XCircle size={16}/> 缺席 ({absentList.length})</h3>
             </div>
             <div className="p-4 max-h-60 overflow-y-auto">
                {absentList.length === 0 ? <p className="text-gray-400 text-sm">無缺席人員</p> : (
                  <ul className="space-y-2">
                    {absentList.map((m: any) => (
                      <li key={m.id} className="text-sm font-bold text-red-600 py-1 border-b border-red-100 last:border-0">
                         {m.name}
                      </li>
                    ))}
                  </ul>
                )}
             </div>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
          <Search size={18} className="text-gray-400" />
          <input 
            type="text" 
            placeholder="搜尋會員編號、姓名或公司..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="bg-transparent outline-none w-full text-sm"
          />
        </div>
        
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left relative">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4 w-20">No.</th>
                <th className="px-6 py-4 w-1/4">會員資訊</th>
                <th className="px-6 py-4">出席狀況</th>
                <th className="px-6 py-4 w-32 text-right">時間</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredMembers.map(member => {
                 const record = getMemberRecord(member.id);
                 const currentStatus = record?.status;
                 const updatedAt = record?.updated_at;
                 
                 return (
                  <tr key={member.id} className={`hover:bg-gray-50/50 transition-colors ${currentStatus ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-6 py-4 font-mono text-gray-400 font-bold">{member.member_no}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{member.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{member.company}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {statusOptions.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => selectedActivityId && onUpdateAttendance(selectedActivityId, String(member.id), opt.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                              currentStatus === opt.value ? opt.activeColor : opt.color
                            } ${!selectedActivityId ? 'opacity-50 cursor-not-allowed' : ''} ${currentStatus === opt.value ? 'shadow-md scale-105' : 'opacity-70 hover:opacity-100'}`}
                            disabled={!selectedActivityId}
                          >
                            {opt.label}
                          </button>
                        ))}
                        
                        {/* 恢復(重置)按鈕：只有當有狀態時才顯示 */}
                        {currentStatus && selectedActivityId && (
                           <button
                             onClick={() => onDeleteAttendance(selectedActivityId, String(member.id))}
                             className="ml-2 px-2 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all flex items-center gap-1"
                             title="清除狀態 (重置)"
                           >
                             <RotateCcw size={14} />
                             <span className="hidden sm:inline">重置</span>
                           </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       {currentStatus && updatedAt && (
                         <div className="flex items-center justify-end gap-1 text-xs text-gray-400 font-mono">
                           <Clock size={12} />
                           {formatTime(updatedAt)}
                         </div>
                       )}
                    </td>
                  </tr>
                 );
              })}
            </tbody>
          </table>
        </div>
        {filteredMembers.length === 0 && (
          <div className="p-10 text-center text-gray-400">沒有找到符合的會員資料</div>
        )}
      </div>
    </div>
  );
};


const MemberManager: React.FC<{ 
  members: Member[], 
  onAddMember: (m: Member) => void, 
  onAddMembers?: (m: Member[]) => void, // 批次匯入
  onUpdateMember: (m: Member) => void, 
  onDeleteMember: (id: string | number) => void 
}> = ({ members, onAddMember, onAddMembers, onUpdateMember, onDeleteMember }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const memberData: Member = {
      id: editingMember?.id || '',
      member_no: formData.get('member_no') as string,
      industry_chain: formData.get('industry_chain') as any,
      industry_category: formData.get('industry_category') as string,
      name: formData.get('name') as string,
      company: formData.get('company') as string,
      website: formData.get('website') as string,
      intro: formData.get('intro') as string
    };

    if (editingMember) onUpdateMember(memberData);
    else onAddMember(memberData);

    setIsModalOpen(false);
    setEditingMember(null);
  };

  const confirmDelete = (member: Member) => {
    if (window.confirm(`確定要刪除會員「${member.name} (${member.company})」嗎？`)) {
      onDeleteMember(member.id);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = '\uFEFF會員編號,產業鏈(美食/工程/健康/幸福/工商),行業別,姓名,公司名稱,會員簡介,網站連結\n001,工商,網站設計,王小明,長展科技,專注於高質感網站設計...,https://example.com';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '會員匯入範本.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          alert('檔案內容為空');
          return;
        }
        
        // 優化：同時支援 \r\n, \n, \r (解決 Excel/Mac 格式問題)
        const lines = text.split(/\r\n|\n|\r/);
        const newMembers: Member[] = [];
        
        // 判斷是否有標題列 (檢查第一行是否包含 "會員" 或 "編號")
        let startIndex = 0;
        if (lines.length > 0 && (lines[0].includes('會員') || lines[0].includes('編號'))) {
          startIndex = 1;
        }
        
        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // 簡易 CSV 解析
          const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
          
          // 寬鬆檢查：只要有前 4 個欄位 (編號, 產業, 行業, 姓名) 就算有效
          if (cols.length < 4) {
             console.warn(`Line ${i+1} skipped due to insufficient columns:`, line);
             continue;
          }

          // 處理 "-" 符號，轉為空字串
          const cleanVal = (val: string) => (val === '-' || !val) ? '' : val;

          newMembers.push({
            id: Date.now() + i, // 暫時 ID，資料庫會重產
            member_no: cleanVal(cols[0]),
            industry_chain: (['美食', '工程', '健康', '幸福', '工商'].includes(cols[1]) ? cols[1] : '工商') as any,
            industry_category: cleanVal(cols[2]),
            name: cleanVal(cols[3]),
            company: cleanVal(cols[4]),
            intro: cleanVal(cols[5]),
            website: cleanVal(cols[6])
          });
        }

        if (newMembers.length > 0) {
          if (window.confirm(`解析成功！共發現 ${newMembers.length} 筆資料。\n確定要匯入嗎？`)) {
            if (onAddMembers) {
              onAddMembers(newMembers);
            } else {
              alert('系統錯誤：找不到匯入函式 (onAddMembers is undefined)');
            }
          }
        } else {
          alert(`解析失敗。讀取到 ${lines.length} 行，但無法識別有效資料。\n原因可能是：\n1. 檔案格式不正確 (需為逗號分隔 CSV)\n2. 沒有有效資料行\n3. 編碼問題 (請嘗試另存為 UTF-8 編碼)`);
        }
      } catch (err) {
        console.error(err);
        alert('讀取檔案發生錯誤，請檢查檔案是否損毀。');
      } finally {
        // 清空 input 讓同一檔案可以再次選取
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // 排序顯示：依照會員編號 (修正：安全轉換為字串後比較)
  const sortedMembers = [...members].sort((a, b) => {
    const valA = a.member_no !== undefined && a.member_no !== null ? String(a.member_no) : '';
    const valB = b.member_no !== undefined && b.member_no !== null ? String(b.member_no) : '';
    
    // 如果兩者都沒有編號，保持原順序或用 ID 排
    if (!valA && !valB) return 0;
    if (!valA) return 1;
    if (!valB) return -1;
    
    return valA.localeCompare(valB, undefined, { numeric: true });
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">會員資料管理</h1>
        <div className="flex gap-2">
          <button 
            onClick={handleDownloadTemplate} 
            className="flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors border border-gray-200"
            title="下載 CSV 範本"
          >
            <Download size={18} /> <span className="hidden sm:inline">下載範本</span>
          </button>
          <div className="relative">
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            >
              <FileUp size={18} /> 匯入 CSV
            </button>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".csv" 
              className="hidden" 
              onChange={handleImportCSV} 
            />
          </div>
          <button onClick={() => { setEditingMember(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-sm">
            <UserPlus size={18} /> 新增會員
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              <th className="px-6 py-4">編號</th>
              <th className="px-6 py-4">產業鏈</th>
              <th className="px-6 py-4">行業別</th>
              <th className="px-6 py-4">品牌/公司</th>
              <th className="px-6 py-4">姓名</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sortedMembers.map(member => (
              <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 font-mono text-gray-400 font-bold">{member.member_no}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    member.industry_chain === '美食' ? 'bg-orange-100 text-orange-600' :
                    member.industry_chain === '工程' ? 'bg-blue-100 text-blue-600' :
                    member.industry_chain === '健康' ? 'bg-green-100 text-green-600' :
                    member.industry_chain === '幸福' ? 'bg-pink-100 text-pink-600' :
                    'bg-purple-100 text-purple-600'
                  }`}>
                    {member.industry_chain}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-700 font-medium">{member.industry_category}</td>
                <td className="px-6 py-4 font-bold text-gray-900">
                  {member.company || <span className="text-gray-300 font-normal">-</span>}
                  {member.website && (
                    <a href={member.website} target="_blank" rel="noopener noreferrer" className="ml-2 inline-block text-gray-400 hover:text-red-600">
                      <Globe size={14} />
                    </a>
                  )}
                </td>
                <td className="px-6 py-4 text-gray-700">{member.name}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setEditingMember(member); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Edit size={16} /></button>
                    <button onClick={() => confirmDelete(member)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && (
          <div className="p-10 text-center text-gray-400">目前尚無會員資料</div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">{editingMember ? '修改會員資料' : '新增會員'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">會員編號</label>
                  <input name="member_no" required defaultValue={editingMember?.member_no} className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500 font-mono" placeholder="001" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">產業鏈</label>
                  <select name="industry_chain" defaultValue={editingMember?.industry_chain || '工商'} className="w-full border rounded-lg px-3 py-3 bg-white outline-none focus:ring-2 focus:ring-red-500">
                    <option value="美食">美食產業鏈</option>
                    <option value="工程">工程產業鏈</option>
                    <option value="健康">健康產業鏈</option>
                    <option value="幸福">幸福產業鏈</option>
                    <option value="工商">工商產業鏈</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">行業別</label>
                   <input name="industry_category" required defaultValue={editingMember?.industry_category} className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" placeholder="例如：網站設計" />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">大名</label>
                   <input name="name" required defaultValue={editingMember?.name} className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" placeholder="姓名" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">品牌 / 公司名稱</label>
                <input name="company" required defaultValue={editingMember?.company} className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" placeholder="公司名稱" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">會員簡介 (選填)</label>
                <textarea 
                  name="intro" 
                  rows={3} 
                  defaultValue={editingMember?.intro} 
                  className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500 resize-none" 
                  placeholder="請輸入簡短的服務介紹或個人簡介..." 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">網站連結 (選填)</label>
                <input name="website" type="url" defaultValue={editingMember?.website} className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" placeholder="https://..." />
              </div>
              
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 border py-3 rounded-lg font-bold text-gray-500 hover:bg-gray-50 transition-colors">取消</button>
                <button type="submit" className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold shadow-lg shadow-red-100 hover:bg-red-700 active:scale-95 transition-all">確認儲存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const UserManager: React.FC<{ 
  users: AdminUser[], 
  onAddUser: (u: AdminUser) => void, 
  onDeleteUser: (id: string) => void,
  currentUser: AdminUser
}> = ({ users, onAddUser, onDeleteUser, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newUser: AdminUser = {
      id: Date.now().toString(),
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      password: formData.get('password') as string,
      role: formData.get('role') as UserRole
    };
    onAddUser(newUser);
    setIsModalOpen(false);
  };

  const confirmDelete = (user: AdminUser) => {
    if (user.id === currentUser.id) {
        alert('無法刪除自己');
        return;
    }
    if (window.confirm(`確定要刪除管理員「${user.name}」嗎？`)) {
      onDeleteUser(user.id);
    }
  };

  return (
    <div className="space-y-6 text-gray-900">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">人員權限管理</h1>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                <UserPlus size={18} /> 新增人員
            </button>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        <th className="px-6 py-4">姓名</th>
                        <th className="px-6 py-4">電話</th>
                        <th className="px-6 py-4">權限角色</th>
                        <th className="px-6 py-4 text-right">操作</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {users.map(user => (
                        <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-gray-900">
                                {user.name} 
                                {user.id === currentUser.id && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded ml-2 uppercase font-bold tracking-wider">You</span>}
                            </td>
                            <td className="px-6 py-4 font-mono text-gray-500">{user.phone}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    user.role === UserRole.SUPER_ADMIN ? 'bg-purple-100 text-purple-600' :
                                    user.role === UserRole.MANAGER ? 'bg-blue-100 text-blue-600' :
                                    'bg-gray-100 text-gray-600'
                                }`}>
                                    {user.role}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                {user.role !== UserRole.SUPER_ADMIN && user.id !== currentUser.id && (
                                    <button onClick={() => confirmDelete(user)} className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {isModalOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
                    <h2 className="text-xl font-bold mb-6">新增管理人員</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">姓名</label>
                            <input name="name" required className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" placeholder="姓名" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">手機號碼 (登入帳號)</label>
                            <input name="phone" required className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" placeholder="09xx-xxx-xxx" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">密碼</label>
                            <input name="password" type="password" required className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" placeholder="設定密碼" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">權限角色</label>
                            <select name="role" className="w-full border rounded-lg px-3 py-3 bg-white outline-none focus:ring-2 focus:ring-red-500">
                                <option value={UserRole.STAFF}>工作人員 (僅查看報到)</option>
                                <option value={UserRole.MANAGER}>管理員 (可管理活動與會員)</option>
                                <option value={UserRole.SUPER_ADMIN}>總管理員 (完全權限)</option>
                            </select>
                        </div>
                        <div className="flex gap-4 pt-4">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 border py-3 rounded-lg font-bold text-gray-500 hover:bg-gray-50 transition-colors">取消</button>
                            <button type="submit" className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold shadow-lg shadow-red-100 hover:bg-red-700 active:scale-95 transition-all">確認新增</button>
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
          <Route path="/check-in" element={<CheckInManager activities={props.activities} registrations={props.registrations} onUpdateRegistration={props.onUpdateRegistration} onDeleteRegistration={props.onDeleteRegistration} />} />
          {/* 加入新的路由，所有管理員等級皆可訪問 */}
          <Route path="/attendance" element={<MemberAttendanceManager activities={props.activities} members={props.members} attendance={props.attendance} onUpdateAttendance={props.onUpdateAttendance} onDeleteAttendance={props.onDeleteAttendance} />} />
          
          {canAccessActivities && (
            <>
              <Route path="/activities" element={<ActivityManager activities={props.activities} onAddActivity={props.onAddActivity} onUpdateActivity={props.onUpdateActivity} onDeleteActivity={props.onDeleteActivity} onUploadImage={props.onUploadImage} />} />
              <Route path="/members" element={
                <MemberManager 
                  members={props.members} 
                  onAddMember={props.onAddMember} 
                  onAddMembers={props.onAddMembers} // 傳遞批次匯入
                  onUpdateMember={props.onUpdateMember} 
                  onDeleteMember={props.onDeleteMember} 
                />
              } />
            </>
          )}
          {canAccessUsers && <Route path="/users" element={<UserManager users={props.users} onAddUser={props.onAddUser} onDeleteUser={props.onDeleteUser} currentUser={props.currentUser} />} />}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default AdminDashboard;
