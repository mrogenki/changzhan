import React, { useState } from 'react';
import { Download, UserPlus, Edit, Trash2, Shield, Eye, EyeOff, Globe, CalendarDays, FileDown, Bell, AlertTriangle, X, UploadCloud, Loader2, Image as ImageIcon } from 'lucide-react';
import { Member } from '../../types';

interface MemberManagerProps {
  members: Member[];
  onAddMember: (m: Member) => void;
  onUpdateMember: (m: Member) => void;
  onDeleteMember: (id: string | number) => void;
  onUploadImage: (file: File) => Promise<string>;
}

const MemberManager: React.FC<MemberManagerProps> = ({ members, onAddMember, onUpdateMember, onDeleteMember, onUploadImage }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [memberPicture, setMemberPicture] = useState<string>('');

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
      intro: formData.get('intro') as string,
      status: formData.get('status') as 'active' | 'inactive',
      join_date: formData.get('join_date') as string,
      end_date: formData.get('end_date') as string,
      birthday: formData.get('birthday') as string,
      picture: memberPicture,
      // 新增欄位
      company_title: formData.get('company_title') as string,
      tax_id: formData.get('tax_id') as string,
      mobile_phone: formData.get('mobile_phone') as string,
      landline: formData.get('landline') as string,
      address: formData.get('address') as string,
      group_name: formData.get('group_name') as string,
    };

    if (editingMember) onUpdateMember(memberData);
    else onAddMember(memberData);

    setIsModalOpen(false);
    setEditingMember(null);
  };

  const confirmDelete = (member: Member) => {
    if (window.confirm(`確定要刪除會員「${member.name} (${member.company})」嗎？\n注意：這會永久刪除會員資料。若只是要停止會籍，建議使用「編輯」並將狀態改為「停權/離會」。`)) {
      onDeleteMember(member.id);
    }
  };

  const getExpiringMembers = () => {
    const now = new Date();
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(now.getDate() + 90);

    return members.filter(m => {
      if (!m.end_date || m.status === 'inactive') return false;
      const endDate = new Date(m.end_date);
      return endDate >= now && endDate <= ninetyDaysFromNow;
    }).sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime());
  };

  const expiringMembers = getExpiringMembers();

  const handleExportMembers = () => {
    if (members.length === 0) {
      alert('目前無會員資料可匯出');
      return;
    }
    
    // 定義標題
    const headers = ['會員編號', '組別', '產業鏈', '行業別', '姓名', '公司名稱', '公司抬頭', '統一編號', '手機號碼', '室內電話', '地址', '會員簡介', '網站連結', '狀態', '入會日期', '會籍到期日', '生日'];
    
    // 加入 BOM 以讓 Excel 正確識別 UTF-8
    let csvContent = '\uFEFF'; 
    csvContent += headers.join(',') + '\n';

    members.forEach(m => {
      const escape = (text: string | number | undefined) => {
        if (!text) return '""';
        return `"${String(text).replace(/"/g, '""')}"`;
      };

      const row = [
        escape(m.member_no),
        escape(m.group_name),
        escape(m.industry_chain),
        escape(m.industry_category),
        escape(m.name),
        escape(m.company),
        escape(m.company_title),
        escape(m.tax_id),
        escape(m.mobile_phone),
        escape(m.landline),
        escape(m.address),
        escape(m.intro),
        escape(m.website),
        escape(m.status === 'inactive' ? '停權/離會' : '活躍'),
        escape(m.join_date),
        escape(m.end_date),
        escape(m.birthday)
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const dateStr = new Date().toISOString().split('T')[0];
    link.href = url;
    link.setAttribute('download', `會員名單_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sortedMembers = [...members].sort((a, b) => {
    const valA = a.member_no !== undefined && a.member_no !== null ? String(a.member_no) : '';
    const valB = b.member_no !== undefined && b.member_no !== null ? String(b.member_no) : '';
    if (!valA && !valB) return 0;
    if (!valA) return 1;
    if (!valB) return -1;
    return valA.localeCompare(valB, undefined, { numeric: true });
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const url = await onUploadImage(file);
        setMemberPicture(url);
      } catch (error: any) {
        console.error('Upload error:', error);
        alert('圖片上傳失敗: ' + (error.message || '請檢查 Supabase Storage 權限設定'));
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleOpenModal = (member?: Member) => {
    if (member) {
      setEditingMember(member);
      setMemberPicture(member.picture || '');
    } else {
      setEditingMember(null);
      setMemberPicture('');
    }
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">會員資料管理</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsNotificationOpen(true)}
            className="relative flex items-center gap-2 bg-white text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
            title="會員狀態通知"
          >
            <Bell size={18} className={expiringMembers.length > 0 ? "text-red-500 animate-bounce" : ""} />
            <span className="hidden sm:inline">狀態通知</span>
            {expiringMembers.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                {expiringMembers.length}
              </span>
            )}
          </button>
           <button 
            onClick={handleExportMembers} 
            className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
            title="匯出 Excel (CSV)"
          >
            <FileDown size={18} /> <span className="hidden sm:inline">匯出 Excel</span>
          </button>
          <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-sm">
            <UserPlus size={18} /> 新增會員
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              <th className="px-6 py-4">照片</th>
              <th className="px-6 py-4">編號</th>
              <th className="px-6 py-4">產業鏈</th>
              <th className="px-6 py-4">狀態</th>
              <th className="px-6 py-4">品牌/公司</th>
              <th className="px-6 py-4">姓名</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sortedMembers.map(member => (
              <tr key={member.id} className={`hover:bg-gray-50/50 transition-colors ${member.status === 'inactive' ? 'opacity-60 bg-gray-50' : ''}`}>
                <td className="px-6 py-4">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-100">
                    {member.picture ? (
                      <img src={member.picture} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ImageIcon size={16} />
                      </div>
                    )}
                  </div>
                </td>
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
                <td className="px-6 py-4">
                  <div className="flex flex-col items-start gap-1">
                    <span className={`flex w-fit items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      member.status === 'inactive' ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-600'
                    }`}>
                      {member.status === 'inactive' ? <EyeOff size={12}/> : <Eye size={12}/>}
                      {member.status === 'inactive' ? '停權/離會' : '活躍'}
                    </span>
                    {member.end_date && (
                      <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1 ml-1">
                        <CalendarDays size={10} />
                        {member.end_date}
                      </span>
                    )}
                  </div>
                </td>
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
                    <button onClick={() => handleOpenModal(member)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Edit size={16} /></button>
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
          <div className="bg-white w-full max-w-2xl rounded-2xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">{editingMember ? '修改會員資料' : '新增會員'}</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-xl space-y-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={16} className="text-red-600"/>
                  <h3 className="font-bold text-gray-700">會籍管理</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   <div className="md:col-span-1">
                      <label className="block text-sm font-bold text-gray-700 mb-1">目前狀態</label>
                      <select 
                        name="status" 
                        defaultValue={editingMember?.status || 'active'} 
                        className="w-full border rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-red-500 font-medium"
                      >
                        <option value="active">活躍 (Active)</option>
                        <option value="inactive">停權/離會 (Inactive)</option>
                      </select>
                   </div>
                   <div className="md:col-span-1">
                      <label className="block text-sm font-bold text-gray-700 mb-1">入會日期</label>
                      <input name="join_date" type="date" defaultValue={editingMember?.join_date} className="w-full border rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-red-500" />
                   </div>
                   <div className="md:col-span-1">
                      <label className="block text-sm font-bold text-gray-700 mb-1">會籍到期日</label>
                      <input name="end_date" type="date" defaultValue={editingMember?.end_date} className="w-full border rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-red-500" />
                   </div>
                   <div className="md:col-span-1">
                      <label className="block text-sm font-bold text-gray-700 mb-1">生日</label>
                      <input name="birthday" type="date" defaultValue={editingMember?.birthday} className="w-full border rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-red-500" />
                   </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">※ 設定為「停權/離會」後，該會員將不會出現在前台列表與點名表中，但資料會保留。</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">會員照片 / Logo</label>
                <div className="flex gap-4 items-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-full overflow-hidden border border-gray-200 flex-shrink-0">
                    {memberPicture ? (
                      <img src={memberPicture} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ImageIcon size={24} />
                      </div>
                    )}
                  </div>
                  <div className="flex-grow">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      id="member-image-upload"
                    />
                    <label 
                      htmlFor="member-image-upload" 
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors ${isUploading ? 'bg-gray-100 text-gray-400 cursor-wait' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                    >
                      {isUploading ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
                      {isUploading ? '上傳中...' : '上傳照片'}
                    </label>
                    <p className="text-[10px] text-gray-400 mt-1">建議尺寸: 400x400px，支援 JPG, PNG</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">會員編號</label>
                  <input name="member_no" required defaultValue={editingMember?.member_no} className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500 font-mono" placeholder="001" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">組別</label>
                  <input name="group_name" defaultValue={editingMember?.group_name} className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" placeholder="例如：第1組" />
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

              {/* 新增：開立發票用的公司抬頭與統編 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">公司抬頭 (選填)</label>
                  <input name="company_title" defaultValue={editingMember?.company_title} className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" placeholder="開立發票用公司全名" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">統一編號 (選填)</label>
                  <input name="tax_id" defaultValue={editingMember?.tax_id} maxLength={8} inputMode="numeric" className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500 font-mono" placeholder="8 碼數字" />
                </div>
              </div>

              {/* 新增：聯絡電話 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">手機號碼 (選填)</label>
                  <input name="mobile_phone" type="tel" defaultValue={editingMember?.mobile_phone} className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" placeholder="09xx-xxx-xxx" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">室內電話 (選填)</label>
                  <input name="landline" type="tel" defaultValue={editingMember?.landline} className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" placeholder="02-xxxx-xxxx" />
                </div>
              </div>

              {/* 新增：地址 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">地址 (選填)</label>
                <input name="address" defaultValue={editingMember?.address} className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" placeholder="公司 / 聯絡地址" />
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

      {isNotificationOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-8 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Bell className="text-red-600" size={24} />
                <h2 className="text-xl font-bold">會員狀態通知</h2>
              </div>
              <button 
                onClick={() => setIsNotificationOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-red-50 p-4 rounded-xl flex items-start gap-3 mb-6 border border-red-100">
              <AlertTriangle className="text-red-600 shrink-0" size={20} />
              <p className="text-sm text-red-800 font-medium">
                以下會員的會籍將在 <span className="font-bold underline">90 天內</span> 到期，請提醒會員進行續約。
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {expiringMembers.length > 0 ? (
                expiringMembers.map(member => {
                  const daysLeft = Math.ceil((new Date(member.end_date!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-red-200 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-bold text-gray-400 border border-gray-100">
                          {member.member_no}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-500">{member.company}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">{member.end_date}</p>
                        <p className="text-[10px] text-gray-400 font-medium">剩餘 {daysLeft} 天</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center">
                  <p className="text-gray-400">目前沒有即將到期的會員</p>
                </div>
              )}
            </div>

            <button 
              onClick={() => setIsNotificationOpen(false)}
              className="w-full mt-6 bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-all"
            >
              關閉視窗
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberManager;
