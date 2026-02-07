
import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, LogOut, ChevronRight, Search, FileDown, Plus, Edit, Trash2, CheckCircle, XCircle, Shield, UserPlus, DollarSign, TrendingUp, BarChart3, Mail, User, Clock, Image as ImageIcon, UploadCloud, Loader2, Smartphone, Building2, Briefcase, Globe, FileUp, Download } from 'lucide-react';
import { Activity, Registration, ActivityType, AdminUser, UserRole, Member } from '../types';

interface AdminDashboardProps {
  currentUser: AdminUser;
  onLogout: () => void;
  activities: Activity[];
  registrations: Registration[];
  users: AdminUser[];
  members: Member[];
  onUpdateActivity: (act: Activity) => void;
  onAddActivity: (act: Activity) => void;
  onDeleteActivity: (id: string | number) => void;
  onUpdateRegistration: (reg: Registration) => void;
  onDeleteRegistration: (id: string | number) => void;
  onAddUser: (user: AdminUser) => void;
  onDeleteUser: (id: string) => void;
  onAddMember: (member: Member) => void;
  onAddMembers?: (members: Member[]) => void; // 新增：批次匯入 Prop
  onUpdateMember: (member: Member) => void;
  onDeleteMember: (id: string | number) => void;
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
          <span>報到管理</span>
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

// ... UserManager, DashboardHome, ActivityManager, CheckInManager components remain mostly the same ...
// ... I will only include the AdminDashboard component structure to wire up the new route ...

const UserManager: React.FC<{ users: AdminUser[], onAddUser: (u: AdminUser) => void, onDeleteUser: (id: string) => void, currentUser: AdminUser }> = ({ users, onAddUser, onDeleteUser, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', password: '', role: UserRole.STAFF });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: AdminUser = {
      id: '', 
      ...formData
    };
    onAddUser(newUser);
    setIsModalOpen(false);
    setFormData({ name: '', phone: '', password: '', role: UserRole.STAFF });
  };

  const confirmDelete = (user: AdminUser) => {
    if (window.confirm(`確定要移除管理員「${user.name}」嗎？\n移除後此帳號將立即失去系統存取權限。`)) {
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
              <th className="px-6 py-4">手機號碼</th>
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
                <td className="px-6 py-4 text-gray-500 text-sm">{user.phone}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                    user.role === UserRole.SUPER_ADMIN ? 'bg-purple-100 text-purple-700' :
                    user.role === UserRole.MANAGER ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {String(user.id) !== String(currentUser.id) ? (
                    <button 
                      onClick={() => confirmDelete(user)} 
                      className="text-gray-300 hover:text-red-600 p-2 transition-colors hover:bg-red-50 rounded-lg"
                      title="刪除此管理員"
                    >
                      <Trash2 size={18} />
                    </button>
                  ) : (
                    <span className="text-[10px] text-gray-300 font-bold px-3 py-1 bg-gray-50 rounded-lg border border-gray-100 uppercase tracking-widest">當前帳號</span>
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
                  <Smartphone size={14} className="text-red-600" /> 手機號碼 (登入帳號)
                </label>
                <input 
                  type="tel" 
                  required 
                  className="w-full border-gray-200 border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500 transition-all"
                  placeholder="09xx-xxx-xxx"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
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

const ActivityManager: React.FC<{ 
  activities: Activity[], 
  onAddActivity: (a: Activity) => void, 
  onUpdateActivity: (a: Activity) => void, 
  onDeleteActivity: (id: string | number) => void,
  onUploadImage: (file: File) => Promise<string>
}> = ({ activities, onAddActivity, onUpdateActivity, onDeleteActivity, onUploadImage }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingActivity) {
      setPreviewUrl(editingActivity.picture);
    } else {
      setPreviewUrl('https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=2069&auto=format&fit=crop');
    }
    setSelectedFile(null);
  }, [editingActivity, isModalOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setIsUploading(true);

    try {
      let finalPictureUrl = previewUrl; 
      if (selectedFile) {
        finalPictureUrl = await onUploadImage(selectedFile);
      }

      const activityData: Activity = {
        id: editingActivity?.id || '', 
        type: formData.get('type') as ActivityType,
        title: formData.get('title') as string,
        date: formData.get('date') as string,
        time: formData.get('time') as string,
        location: formData.get('location') as string,
        price: Number(formData.get('price')),
        picture: finalPictureUrl, 
        description: formData.get('description') as string,
        status: 'active'
      };

      if (editingActivity) onUpdateActivity(activityData);
      else onAddActivity(activityData);

      setIsModalOpen(false);
      setEditingActivity(null);
    } catch (error: any) {
      console.error(error);
      alert('儲存失敗：' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const confirmDelete = (act: Activity) => {
    if (window.confirm(`確定要刪除活動「${act.title}」嗎？\n此動作將同時刪除該活動的所有報名資料且無法復原。`)) {
      onDeleteActivity(act.id);
    }
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
            <img src={act.picture} className="w-32 object-cover" alt={act.title} />
            <div className="p-4 flex-grow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">{act.type}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingActivity(act); setIsModalOpen(true); }} className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-md transition-colors"><Edit size={16} /></button>
                  <button onClick={() => confirmDelete(act)} className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={16} /></button>
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
                <select name="type" defaultValue={editingActivity?.type} className="w-full border rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-red-500">
                  <option value={ActivityType.REGULAR}>例會</option>
                  <option value={ActivityType.SPECIAL}>精選活動</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">活動標題</label>
                <input name="title" required defaultValue={editingActivity?.title} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500" placeholder="活動標題" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">日期</label>
                  <input type="date" name="date" required defaultValue={editingActivity?.date} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500" />
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
                  <p className="text-[10px] text-gray-400 mt-1 font-bold italic">※ 例如 18:30</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">費用 (NT$)</label>
                  <input name="price" type="number" required defaultValue={editingActivity?.price} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500" placeholder="費用" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">活動地點</label>
                  <input name="location" required defaultValue={editingActivity?.location} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500" placeholder="活動地點" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <ImageIcon size={14} className="text-red-600" /> 封面圖片 (上傳或輸入網址)
                </label>
                <div 
                  className="relative group cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-2 hover:border-red-500 transition-colors bg-gray-50 flex flex-col items-center justify-center min-h-[160px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {previewUrl ? (
                    <div className="relative w-full h-full">
                      <img src={previewUrl} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                        <span className="text-white font-bold flex items-center gap-2"><UploadCloud size={20}/> 更換圖片</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400 flex flex-col items-center">
                      <UploadCloud size={32} className="mb-2" />
                      <span className="text-sm">點擊選擇圖片</span>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </div>
                <div className="mt-2">
                  <input 
                    type="text"
                    value={previewUrl}
                    onChange={(e) => {
                      setPreviewUrl(e.target.value);
                      setSelectedFile(null); 
                    }}
                    placeholder="或在此直接貼上圖片網址..."
                    className="w-full text-xs text-gray-500 border border-gray-200 rounded px-2 py-1.5 bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">活動描述</label>
                <textarea name="description" rows={4} required defaultValue={editingActivity?.description} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500" placeholder="活動描述"></textarea>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 border py-3 rounded-lg font-bold text-gray-500 hover:bg-gray-50 transition-colors">取消</button>
                <button 
                  type="submit" 
                  disabled={isUploading}
                  className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold shadow-lg shadow-red-100 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUploading ? <><Loader2 className="animate-spin" size={20} /> 處理中...</> : '儲存活動'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const CheckInManager: React.FC<{ activities: Activity[], registrations: Registration[], onUpdateRegistration: (r: Registration) => void, onDeleteRegistration: (id: string | number) => void }> = ({ activities, registrations, onUpdateRegistration, onDeleteRegistration }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('all');
  const filteredRegistrations = registrations.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.phone.includes(searchTerm);
    const matchesActivity = selectedActivity === 'all' || String(r.activityId) === String(selectedActivity);
    return matchesSearch && matchesActivity;
  });

  const confirmDelete = (reg: Registration) => {
    if (window.confirm(`確定要刪除「${reg.name}」的報名紀錄嗎？\n此動作無法復原且會影響活動統計。`)) {
      onDeleteRegistration(reg.id);
    }
  };

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
    if (selectedActivity !== 'all') {
      const act = activities.find(a => String(a.id) === String(selectedActivity));
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
    <div className="space-y-6 text-gray-900">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">報到管理</h1>
        <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all hover:bg-green-700 active:scale-95"><FileDown size={18}/> 匯出報名表</button>
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
            <tr>
              <th className="pb-4">姓名 / 公司</th>
              <th className="pb-4">引薦人</th>
              <th className="pb-4">繳費</th>
              <th className="pb-4">狀態</th>
              <th className="pb-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredRegistrations.map(reg => (
              <tr key={reg.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-4">
                  <div className="font-bold">{reg.name}</div>
                  <div className="text-xs text-gray-400">{reg.company}</div>
                </td>
                <td className="py-4 text-sm text-gray-500">
                  {reg.referrer || '-'}
                </td>
                <td className="py-4">
                  <PaidAmountInput 
                    value={reg.paid_amount || 0} 
                    onSave={(val) => onUpdateRegistration({...reg, paid_amount: val})} 
                  />
                </td>
                <td className="py-4">
                  <button onClick={() => onUpdateRegistration({...reg, check_in_status: !reg.check_in_status})} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${reg.check_in_status ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                    {reg.check_in_status ? '已報到' : '未報到'}
                  </button>
                </td>
                <td className="py-4 text-right">
                  <button onClick={() => confirmDelete(reg)} className="text-gray-300 hover:text-red-600 transition-colors p-1.5 hover:bg-red-50 rounded-md">
                    <Trash2 size={18}/>
                  </button>
                </td>
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
