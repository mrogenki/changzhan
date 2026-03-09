
import React, { useState, useRef } from 'react';
import { Download, FileUp, UserPlus, Edit, Trash2, Shield, Eye, EyeOff, Globe, CalendarDays, FileDown } from 'lucide-react';
import { Member } from '../../types';

interface MemberManagerProps {
  members: Member[];
  onAddMember: (m: Member) => void;
  onAddMembers?: (m: Member[]) => void;
  onUpdateMember: (m: Member) => void;
  onDeleteMember: (id: string | number) => void;
}

const MemberManager: React.FC<MemberManagerProps> = ({ members, onAddMember, onAddMembers, onUpdateMember, onDeleteMember }) => {
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
      intro: formData.get('intro') as string,
      status: formData.get('status') as 'active' | 'inactive',
      join_date: formData.get('join_date') as string,
      end_date: formData.get('end_date') as string,
      birthday: formData.get('birthday') as string
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

  const handleDownloadTemplate = () => {
    const csvContent = '\uFEFF會員編號,產業鏈(美食/工程/健康/幸福/工商),行業別,姓名,公司名稱,會員簡介,網站連結,狀態(active/inactive),入會日,會籍到期日,生日\n001,工商,網站設計,王小明,長展科技,專注於高質感網站設計...,https://example.com,active,2024-01-01,2025-01-01,1990-01-01';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '會員匯入範本.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportMembers = () => {
    if (members.length === 0) {
      alert('目前無會員資料可匯出');
      return;
    }
    
    // 定義標題
    const headers = ['會員編號', '產業鏈', '行業別', '姓名', '公司名稱', '會員簡介', '網站連結', '狀態', '入會日期', '會籍到期日', '生日'];
    
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
        escape(m.industry_chain),
        escape(m.industry_category),
        escape(m.name),
        escape(m.company),
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
        
        const lines = text.split(/\r\n|\n|\r/);
        const newMembers: Member[] = [];
        
        let startIndex = 0;
        if (lines.length > 0 && (lines[0].includes('會員') || lines[0].includes('編號'))) {
          startIndex = 1;
        }
        
        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
          
          if (cols.length < 4) {
             console.warn(`Line ${i+1} skipped due to insufficient columns:`, line);
             continue;
          }

          const cleanVal = (val: string) => (val === '-' || !val) ? '' : val;

          newMembers.push({
            id: Date.now() + i,
            member_no: cleanVal(cols[0]),
            industry_chain: (['美食', '工程', '健康', '幸福', '工商'].includes(cols[1]) ? cols[1] : '工商') as any,
            industry_category: cleanVal(cols[2]),
            name: cleanVal(cols[3]),
            company: cleanVal(cols[4]),
            intro: cleanVal(cols[5]),
            website: cleanVal(cols[6]),
            status: cols[7] === 'inactive' ? 'inactive' : 'active',
            join_date: cleanVal(cols[8]),
            end_date: cleanVal(cols[9]),
            birthday: cleanVal(cols[10])
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
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const sortedMembers = [...members].sort((a, b) => {
    const valA = a.member_no !== undefined && a.member_no !== null ? String(a.member_no) : '';
    const valB = b.member_no !== undefined && b.member_no !== null ? String(b.member_no) : '';
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
           <button 
            onClick={handleExportMembers} 
            className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
            title="匯出 Excel (CSV)"
          >
            <FileDown size={18} /> <span className="hidden sm:inline">匯出 Excel</span>
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
              <th className="px-6 py-4">狀態</th>
              <th className="px-6 py-4">品牌/公司</th>
              <th className="px-6 py-4">姓名</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sortedMembers.map(member => (
              <tr key={member.id} className={`hover:bg-gray-50/50 transition-colors ${member.status === 'inactive' ? 'opacity-60 bg-gray-50' : ''}`}>
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

export default MemberManager;
