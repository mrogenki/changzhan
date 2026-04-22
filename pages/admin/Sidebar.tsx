import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, LogOut, ClipboardList, Building2, Shield, Banknote, Award, Cake, CalendarClock, X } from 'lucide-react';
import { AdminUser, UserRole } from '../../types';

interface SidebarProps {
  user: AdminUser;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout, isOpen, onClose }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const canAccessActivities = user.role === UserRole.MANAGER || user.role === UserRole.SUPER_ADMIN;
  const canAccessUsers = user.role === UserRole.SUPER_ADMIN;

  // 點連結後自動關閉(手機版需要,桌面版無視覺影響)
  const handleNavClick = () => onClose();

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 p-3 rounded-lg transition-colors ${
      active ? 'bg-red-600 text-white' : 'hover:bg-gray-800'
    }`;

  return (
    <>
      {/* 手機版背景遮罩 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar 本體 */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 w-64 flex-shrink-0
          bg-gray-900 text-gray-400 flex flex-col min-h-screen
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <div className="p-6 border-b border-gray-800 relative">
          {/* 手機版關閉鈕 */}
          <button
            onClick={onClose}
            className="md:hidden absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            aria-label="關閉選單"
          >
            <X size={20} />
          </button>

          <Link to="/" className="flex items-center gap-3 text-white" onClick={handleNavClick}>
            <div className="w-8 h-8 bg-red-600 rounded-md flex items-center justify-center text-white font-bold flex-shrink-0">長</div>
            <span className="font-bold tracking-tight">管理系統</span>
          </Link>
          <div className="mt-4 px-3 py-2 rounded bg-gray-800 border border-gray-700">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{user.role}</p>
            <p className="text-sm text-white font-medium truncate">{user.name}</p>
          </div>
        </div>

        <nav className="flex-grow p-4 space-y-2 overflow-y-auto">
          <Link to="/admin" onClick={handleNavClick} className={linkClass(isActive('/admin'))}>
            <LayoutDashboard size={20} />
            <span>儀表板</span>
          </Link>
          <Link to="/admin/check-in" onClick={handleNavClick} className={linkClass(location.pathname.startsWith('/admin/check-in'))}>
            <Users size={20} />
            <span>報到管理 (訪客)</span>
          </Link>

          <Link to="/admin/attendance" onClick={handleNavClick} className={linkClass(location.pathname.startsWith('/admin/attendance'))}>
            <ClipboardList size={20} />
            <span>會員報到 (會員專屬)</span>
          </Link>

          <Link to="/admin/finance" onClick={handleNavClick} className={linkClass(location.pathname.startsWith('/admin/finance'))}>
            <Banknote size={20} />
            <span>收支管理</span>
          </Link>

          <Link to="/admin/milestones" onClick={handleNavClick} className={linkClass(location.pathname.startsWith('/admin/milestones'))}>
            <Award size={20} />
            <span>大事記管理</span>
          </Link>

          {canAccessActivities && (
            <>
              <Link to="/admin/activities" onClick={handleNavClick} className={linkClass(location.pathname.startsWith('/admin/activities'))}>
                <Calendar size={20} />
                <span>活動管理</span>
              </Link>
              <Link to="/admin/members" onClick={handleNavClick} className={linkClass(location.pathname.startsWith('/admin/members'))}>
                <Building2 size={20} />
                <span>會員管理</span>
              </Link>
              <Link to="/admin/birthdays" onClick={handleNavClick} className={linkClass(location.pathname.startsWith('/admin/birthdays'))}>
                <Cake size={20} />
                <span>會員生日管理</span>
              </Link>
              <Link to="/admin/membership-expiry" onClick={handleNavClick} className={linkClass(location.pathname.startsWith('/admin/membership-expiry'))}>
                <CalendarClock size={20} />
                <span>會員會籍管理</span>
              </Link>
            </>
          )}

          {canAccessUsers && (
            <Link to="/admin/users" onClick={handleNavClick} className={linkClass(location.pathname.startsWith('/admin/users'))}>
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
      </aside>
    </>
  );
};

export default Sidebar;
