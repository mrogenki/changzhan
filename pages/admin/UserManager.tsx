
import React, { useState } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import { AdminUser, UserRole } from '../../types';

interface UserManagerProps {
  users: AdminUser[];
  onAddUser: (u: AdminUser) => void;
  onDeleteUser: (id: string) => void;
  currentUser: AdminUser;
}

const UserManager: React.FC<UserManagerProps> = ({ users, onAddUser, onDeleteUser, currentUser }) => {
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

export default UserManager;
