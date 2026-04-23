import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
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
            <Link to="/milestones
