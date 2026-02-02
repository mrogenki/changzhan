
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, Mail } from 'lucide-react';
import { AdminUser } from '../types';

interface LoginPageProps {
  users: AdminUser[];
  onLogin: (user: AdminUser) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ users, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      onLogin(user);
    } else {
      setError('帳號或密碼錯誤');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-2xl text-white mb-4 shadow-lg">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 font-sans tracking-tight">管理員登入</h1>
          <p className="text-gray-400 mt-2 font-medium">長展分會活動報名管理系統</p>
        </div>

        <div className="bg-white p-10 rounded-[32px] shadow-2xl shadow-gray-200/50 border border-gray-100">
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 px-1">電子郵件</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  required
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none text-gray-700"
                  placeholder="admin@changzhan.com"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 px-1">登入密碼</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  required
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none text-gray-700"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-xs font-bold py-3 rounded-xl text-center border border-red-100">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-red-700 active:scale-[0.98] transition-all shadow-xl shadow-red-200"
            >
              進入管理後台
            </button>
          </form>
        </div>
        
        <div className="text-center mt-8">
          <Link to="/" className="text-gray-400 hover:text-red-600 text-sm font-medium transition-colors">
            返回活動網站首頁
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
