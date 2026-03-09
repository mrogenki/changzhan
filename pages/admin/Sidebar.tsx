
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, LogOut, ClipboardList, Building2, Shield } from 'lucide-react';
import { AdminUser, UserRole } from '../../types';

interface SidebarProps {
  user: AdminUser;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
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

export default Sidebar;
