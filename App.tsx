import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Menu, X, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import Home from './pages/Home';
import ActivityDetail from './pages/ActivityDetail';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';
import MemberList from './pages/MemberList';
import Milestones from './pages/Milestones';
import LiffCheckin from './pages/LiffCheckin';
import { Activity, ActivityType, Registration, AdminUser, Member, AttendanceRecord, AttendanceStatus, FinanceRecord, Milestone } from './types';
import { INITIAL_ACTIVITIES, INITIAL_ADMINS, INITIAL_MEMBERS } from './constants';

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
              <span className="text-xl font-bold tracking-tight">長展分會</span>
            </Link>
          </div>
          <div className="hidden sm:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 hover:text-red-600 transition-colors font-medium">活動首頁</Link>
            <Link to="/members" className="text-gray-700 hover:text-red-600 transition-colors font-medium">會員列表</Link>
            <Link to="/milestones" className="text-gray-700 hover:text-red-600 transition-colors font-medium">長展大事記</Link>
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
          <Link to="/milestones" onClick={() => setIsOpen(false)} className="block text-gray-700 font-bold">長展大事記</Link>
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
        <p className="text-gray-400 text-xs">&copy; 2026 長展分會. All rights reserved.</p>
      </div>
    </footer>
  );
};

const App: React.FC = () => {
  // LIFF 報到頁:繞過 Router,直接 render
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/liff/checkin')) {
    return <LiffCheckin />;
  }

  const [activities, setActivities] = useState<Activity[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [financeRecords, setFinanceRecords] = useState<FinanceRecord[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    const saved = sessionStorage.getItem('current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const fetchData = async (isInitialLoad = false) => {
    if (isInitialLoad) setLoading(true);
    try {
      const { data: actData } = await supabase.from('activities').select('*').order('date', { ascending: true }).order('time', { ascending: true });

      if (actData) {
        const needsMigration = actData.some(a => a.type === '例會' || a.type === '近期活動' || a.type === '精選活動');
        if (needsMigration) {
          const updates = actData.map(async (a) => {
            if (a.type === '例會') {
              return supabase.from('activities').update({ type: ActivityType.REGULAR }).eq('id', a.id);
            }
            if (a.type === '近期活動' || a.type === '精選活動') {
              return supabase.from('activities').update({ type: ActivityType.SPECIAL }).eq('id', a.id);
            }
            return Promise.resolve();
          });
          await Promise.all(updates);
          fetchData();
          return;
        }

        const mappedActs = actData.map((a: any) => ({
          ...a,
          status: a
