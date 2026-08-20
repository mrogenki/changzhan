import React, { useState } from 'react';
import { UserPlus, Trash2, Pencil, Eye, PencilLine } from 'lucide-react';
import { AdminUser, UserRole } from '../../types';

interface UserManagerProps {
  users: AdminUser[];
  onAddUser: (u: AdminUser) => void;
  onUpdateUser: (u: AdminUser & { password?: string }) => void;
  onDeleteUser: (id: string) => void;
  currentUser: AdminUser;
}

// 舊帳號用手機衍生的假信箱，列表標記出來提醒改成真實 Email
const LEGACY_EMAIL_DOMAIN = '@changzhan.local';
const isLegacyEmail = (email?: string) => (email || '').toLowerCase().endsWith(LEGACY_EMAIL_DOMAIN);

const UserManager: React.FC<UserManagerProps> = ({ users, onAddUser, onUpdateUser, onDeleteUser, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string).trim();
    const email = (formData.get('email') as string).trim().toLowerCase();
    const password = (formData.get('password') as string) || '';
    const role = formData.get('role') as UserRole;
    const can_edit = formData.get('can_edit') === 'edit';

    if (editingUser) {
      // 密碼留白代表不變更
      onUpdateUser({ ...editingUser, name, email, role, can_edit, password: password || undefined });
    } else {
      onAddUser({ id: Date.now().toString(), name, email, password, role, can_edit });
    }
    closeModal();
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
            <button onClick={() => { setEditingUser(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                <UserPlus size={18} /> 新增人員
            </button>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        <th className="px-6 py-4">姓名</th>
                        <th className="px-6 py-4">登入信箱</th>
                        <th className="px-6 py-4">權限角色</th>
                        <th className="px-6 py-4">操作權限</th>
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
                            <td className="px-6 py-4 font-mono text-gray-500 break-all">
                                {user.email}
                                {isLegacyEmail(user.email) && (
                                    <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold tracking-wider font-sans align-middle">舊帳號 · 建議改真實信箱</span>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    user.role === UserRole.SUPER_ADMIN ? 'bg-purple-100 text-purple-600' :
                                    user.role === UserRole.MANAGER ? 'bg-blue-100 text-blue-600' :
                                    'bg-gray-100 text-gray-600'
                                }`}>
                                    {user.role}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                {user.can_edit === false ? (
                                    <span className="px-2 py-1 rounded text-xs font-bold bg-amber-100 text-amber-700 inline-flex items-center gap-1">
                                        <Eye size={12} /> 僅檢視
                                    </span>
                                ) : (
                                    <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700 inline-flex items-center gap-1">
                                        <PencilLine size={12} /> 可編輯
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                <button onClick={() => { setEditingUser(user); setIsModalOpen(true); }} className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors" title="編輯信箱／密碼／角色">
                                    <Pencil size={18} />
                                </button>
                                {user.role !== UserRole.SUPER_ADMIN && user.id !== currentUser.id && (
                                    <button onClick={() => confirmDelete(user)} className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors" title="刪除人員">
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
                    <h2 className="text-xl font-bold mb-6">{editingUser ? `編輯人員 — ${editingUser.name}` : '新增管理人員'}</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">姓名</label>
                            <input name="name" required defaultValue={editingUser?.name ?? ''} className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" placeholder="姓名" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Email (登入帳號)</label>
                            <input name="email" type="email" required autoComplete="off" defaultValue={editingUser?.email ?? ''} className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" placeholder="you@example.com" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">{editingUser ? '重設密碼（留白＝不變更）' : '密碼'}</label>
                            <input name="password" type="password" autoComplete="new-password" required={!editingUser} minLength={6} className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" placeholder={editingUser ? '留白則沿用原密碼' : '設定密碼（至少 6 碼）'} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">權限角色</label>
                            <select name="role" defaultValue={editingUser?.role ?? UserRole.STAFF} className="w-full border rounded-lg px-3 py-3 bg-white outline-none focus:ring-2 focus:ring-red-500">
                                <option value={UserRole.STAFF}>工作人員 (僅查看報到)</option>
                                <option value={UserRole.MANAGER}>管理員 (可管理活動與會員)</option>
                                <option value={UserRole.SUPER_ADMIN}>總管理員 (完全權限)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">操作權限</label>
                            <select name="can_edit" defaultValue={editingUser?.can_edit === false ? 'view' : 'edit'} className="w-full border rounded-lg px-3 py-3 bg-white outline-none focus:ring-2 focus:ring-red-500">
                                <option value="edit">可編輯（可新增、修改、刪除資料）</option>
                                <option value="view">僅檢視（只能查看，不能修改任何資料）</option>
                            </select>
                            <p className="text-xs text-gray-400 mt-1">角色決定「看得到哪些頁」，這裡決定「能不能改」。</p>
                        </div>
                        <div className="flex gap-4 pt-4">
                            <button type="button" onClick={closeModal} className="flex-1 border py-3 rounded-lg font-bold text-gray-500 hover:bg-gray-50 transition-colors">取消</button>
                            <button type="submit" className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold shadow-lg shadow-red-100 hover:bg-red-700 active:scale-95 transition-all">{editingUser ? '儲存變更' : '確認新增'}</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default UserManager;
