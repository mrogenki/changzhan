
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, Smartphone } from 'lucide-react';
import { AdminUser } from '../types';
import { INITIAL_ADMINS } from '../constants';

interface LoginPageProps {
  users: AdminUser[];
  onLogin: (user: AdminUser) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ users, onLogin }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 優先檢查資料庫中的使用者
    let foundUser = users.find(u => u.phone === phone && u.password === password);
    
    // 備援：如果資料庫中找不到，檢查常數中的初始管理員 (保證絕對能登入)
    if (!foundUser) {
      foundUser = INITIAL_ADMINS.find(u => u.phone === phone && u.password === password);
    }

    if (foundUser) {
      onLogin(foundUser);
    } else {
      setError('帳號或密碼錯誤，請重新輸入');
      // 兩秒後清除錯誤提示
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full">
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-2xl text-white mb-4 shadow-xl">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">管理員登入</h1>
          <p className="text-gray-400 mt-2 font-medium">長展分會活動管理系統</p>
        </div>

        <div className="bg-white p-10 rounded-[40px] shadow-2xl shadow-gray-200/50 border border-gray-100 animate-in fade-in zoom-in duration-500">
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 px-1 uppercase tracking-widest text-[10px]">手機號碼</label>
              <div className="relative">
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  required
                  type="tel" 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none text-gray-700 font-medium"
                  placeholder="09xx-xxx-xxx"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 px-1 uppercase tracking-widest text-[10px]">登入密碼</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input 
                  required
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none text-gray-700 font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-[13px] font-bold py-3.5 rounded-xl text-center border border-red-100 animate-shake">
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
        
        <div className="text-center mt-10">
          <Link to="/" className="text-gray-400 hover:text-red-600 text-sm font-bold transition-colors">
            ← 返回活動網站首頁
          </Link>
        </div>
      </div>
      
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

export default LoginPage;
