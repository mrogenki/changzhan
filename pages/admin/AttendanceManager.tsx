
import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock, User, ClipboardList, XCircle, Search, RotateCcw } from 'lucide-react';
import { Activity, ActivityType, Member, AttendanceRecord, AttendanceStatus } from '../../types';

interface AttendanceManagerProps {
  activities: Activity[];
  members: Member[];
  attendance: AttendanceRecord[];
  onUpdateAttendance: (actId: string, memId: string, status: AttendanceStatus) => void;
  onDeleteAttendance: (actId: string, memId: string) => void;
}

const AttendanceManager: React.FC<AttendanceManagerProps> = ({ activities, members, attendance, onUpdateAttendance, onDeleteAttendance }) => {
  const allActivities = activities;
  
  const defaultActivityId = React.useMemo(() => {
    if (allActivities.length === 0) return '';
    const now = new Date();
    const sorted = [...allActivities].sort((a, b) => {
       const da = new Date(a.date).getTime();
       const db = new Date(b.date).getTime();
       return Math.abs(da - now.getTime()) - Math.abs(db - now.getTime());
    });
    return String(sorted[0].id);
  }, [allActivities]);

  const [selectedActivityId, setSelectedActivityId] = useState(defaultActivityId);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!selectedActivityId && defaultActivityId) {
      setSelectedActivityId(defaultActivityId);
    }
  }, [defaultActivityId]);

  const activeMembers = members.filter(m => m.status === undefined || m.status === 'active');

  const sortedMembers = [...activeMembers].sort((a, b) => {
    const valA = a.member_no !== undefined && a.member_no !== null ? String(a.member_no) : '';
    const valB = b.member_no !== undefined && b.member_no !== null ? String(b.member_no) : '';
    if (!valA && !valB) return 0;
    if (!valA) return 1;
    if (!valB) return -1;
    return valA.localeCompare(valB, undefined, { numeric: true });
  });

  const filteredMembers = sortedMembers.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.member_no && String(m.member_no).includes(searchTerm))
  );

  const stats = React.useMemo(() => {
    const records = attendance.filter(r => String(r.activity_id) === String(selectedActivityId));
    return {
      total: activeMembers.length,
      marked: records.filter(r => activeMembers.some(m => String(m.id) === String(r.member_id))).length,
      present: records.filter(r => r.status === AttendanceStatus.PRESENT && activeMembers.some(m => String(m.id) === String(r.member_id))).length,
      absent: records.filter(r => r.status === AttendanceStatus.ABSENT && activeMembers.some(m => String(m.id) === String(r.member_id))).length,
      late: records.filter(r => r.status === AttendanceStatus.LATE && activeMembers.some(m => String(m.id) === String(r.member_id))).length,
      medical: records.filter(r => r.status === AttendanceStatus.MEDICAL && activeMembers.some(m => String(m.id) === String(r.member_id))).length,
      substitute: records.filter(r => r.status === AttendanceStatus.SUBSTITUTE && activeMembers.some(m => String(m.id) === String(r.member_id))).length,
    };
  }, [attendance, selectedActivityId, activeMembers]);

  const getMemberRecord = (memberId: string | number) => {
    return attendance.find(r => String(r.activity_id) === String(selectedActivityId) && String(r.member_id) === String(memberId));
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const listByStatus = (status: AttendanceStatus) => {
    const records = attendance.filter(r => String(r.activity_id) === String(selectedActivityId) && r.status === status);
    return records.map(r => {
      const member = activeMembers.find(m => String(m.id) === String(r.member_id));
      if (!member) return null;
      return { ...member, updated_at: r.updated_at };
    }).filter(item => item !== null) as any[]; 
  };

  const lateList = listByStatus(AttendanceStatus.LATE);
  const substituteList = listByStatus(AttendanceStatus.SUBSTITUTE);
  const medicalList = listByStatus(AttendanceStatus.MEDICAL);
  const absentList = listByStatus(AttendanceStatus.ABSENT);

  const statusOptions = [
    { value: AttendanceStatus.PRESENT, label: '出席', color: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200', activeColor: 'bg-green-600 text-white border-green-600' },
    { value: AttendanceStatus.LATE, label: '遲到', color: 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200', activeColor: 'bg-yellow-500 text-white border-yellow-500' },
    { value: AttendanceStatus.SUBSTITUTE, label: '代理', color: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200', activeColor: 'bg-purple-600 text-white border-purple-600' },
    { value: AttendanceStatus.MEDICAL, label: '病假', color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200', activeColor: 'bg-blue-600 text-white border-blue-600' },
    { value: AttendanceStatus.ABSENT, label: '缺席', color: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200', activeColor: 'bg-red-600 text-white border-red-600' },
  ];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">會員報到</h1>
          <p className="text-gray-500 text-sm">所有活動的會員出席狀況記錄。</p>
        </div>
        <div className="w-full md:w-auto">
          <select 
            value={selectedActivityId} 
            onChange={e => setSelectedActivityId(e.target.value)} 
            className="w-full md:w-64 border rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-red-500 font-bold"
          >
            {allActivities.length === 0 && <option value="">無活動資料</option>}
            {allActivities.map(a => (
              <option key={a.id} value={a.id}>{a.date} {a.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
         <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
            <div className="text-xs text-gray-400 font-bold uppercase">總會員數</div>
            <div className="text-xl font-bold text-gray-800">{stats.total}</div>
         </div>
         <div className="bg-green-50 p-3 rounded-xl border border-green-100">
            <div className="text-xs text-green-600 font-bold uppercase">出席 (P)</div>
            <div className="text-xl font-bold text-green-700">{stats.present}</div>
         </div>
         <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
            <div className="text-xs text-yellow-600 font-bold uppercase">遲到 (L)</div>
            <div className="text-xl font-bold text-yellow-700">{stats.late}</div>
         </div>
         <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
            <div className="text-xs text-purple-600 font-bold uppercase">代理 (S)</div>
            <div className="text-xl font-bold text-purple-700">{stats.substitute}</div>
         </div>
         <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
            <div className="text-xs text-blue-600 font-bold uppercase">病假 (M)</div>
            <div className="text-xl font-bold text-blue-700">{stats.medical}</div>
         </div>
         <div className="bg-red-50 p-3 rounded-xl border border-red-100">
            <div className="text-xs text-red-600 font-bold uppercase">缺席 (A)</div>
            <div className="text-xl font-bold text-red-700">{stats.absent}</div>
         </div>
      </div>

      {/* 異常狀況清單列表 */}
      <div>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <AlertCircle size={20} className="text-red-600" />
          異常狀況與代理名單列表
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           {/* 遲到名單 */}
           <div className="bg-white rounded-xl border border-yellow-200 shadow-sm overflow-hidden">
             <div className="bg-yellow-50 px-4 py-3 border-b border-yellow-100 flex justify-between items-center">
               <h3 className="font-bold text-yellow-800 flex items-center gap-2"><Clock size={16}/> 遲到 ({lateList.length})</h3>
             </div>
             <div className="p-4 max-h-60 overflow-y-auto">
                {lateList.length === 0 ? <p className="text-gray-400 text-sm">無遲到人員</p> : (
                  <ul className="space-y-2">
                    {lateList.map((m: any) => (
                      <li key={m.id} className="text-sm font-bold text-gray-700 py-1 border-b border-yellow-100 last:border-0">
                        {m.name}
                      </li>
                    ))}
                  </ul>
                )}
             </div>
           </div>

           {/* 代理名單 */}
           <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden">
             <div className="bg-purple-50 px-4 py-3 border-b border-purple-100 flex justify-between items-center">
               <h3 className="font-bold text-purple-800 flex items-center gap-2"><User size={16}/> 代理 ({substituteList.length})</h3>
             </div>
             <div className="p-4 max-h-60 overflow-y-auto">
                {substituteList.length === 0 ? <p className="text-gray-400 text-sm">無代理人員</p> : (
                  <ul className="space-y-2">
                    {substituteList.map((m: any) => (
                      <li key={m.id} className="text-sm font-bold text-gray-700 py-1 border-b border-purple-100 last:border-0">
                        {m.name}
                      </li>
                    ))}
                  </ul>
                )}
             </div>
           </div>

           {/* 病假名單 */}
           <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
             <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
               <h3 className="font-bold text-blue-800 flex items-center gap-2"><ClipboardList size={16}/> 病假 ({medicalList.length})</h3>
             </div>
             <div className="p-4 max-h-60 overflow-y-auto">
                {medicalList.length === 0 ? <p className="text-gray-400 text-sm">無病假人員</p> : (
                  <ul className="space-y-2">
                    {medicalList.map((m: any) => (
                      <li key={m.id} className="text-sm font-bold text-gray-700 py-1 border-b border-blue-100 last:border-0">
                         {m.name}
                      </li>
                    ))}
                  </ul>
                )}
             </div>
           </div>

           {/* 缺席名單 */}
           <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
             <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex justify-between items-center">
               <h3 className="font-bold text-red-800 flex items-center gap-2"><XCircle size={16}/> 缺席 ({absentList.length})</h3>
             </div>
             <div className="p-4 max-h-60 overflow-y-auto">
                {absentList.length === 0 ? <p className="text-gray-400 text-sm">無缺席人員</p> : (
                  <ul className="space-y-2">
                    {absentList.map((m: any) => (
                      <li key={m.id} className="text-sm font-bold text-red-600 py-1 border-b border-red-100 last:border-0">
                         {m.name}
                      </li>
                    ))}
                  </ul>
                )}
             </div>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
          <Search size={18} className="text-gray-400" />
          <input 
            type="text" 
            placeholder="搜尋會員編號、姓名或公司..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="bg-transparent outline-none w-full text-sm"
          />
        </div>
        
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left relative">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4 w-20">No.</th>
                <th className="px-6 py-4 w-1/4">會員資訊</th>
                <th className="px-6 py-4">出席狀況</th>
                <th className="px-6 py-4 w-32 text-right">時間</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredMembers.map(member => {
                 const record = getMemberRecord(member.id);
                 const currentStatus = record?.status;
                 const updatedAt = record?.updated_at;
                 
                 return (
                  <tr key={member.id} className={`hover:bg-gray-50/50 transition-colors ${currentStatus ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-6 py-4 font-mono text-gray-400 font-bold">{member.member_no}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{member.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{member.company}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {statusOptions.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => selectedActivityId && onUpdateAttendance(selectedActivityId, String(member.id), opt.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                              currentStatus === opt.value ? opt.activeColor : opt.color
                            } ${!selectedActivityId ? 'opacity-50 cursor-not-allowed' : ''} ${currentStatus === opt.value ? 'shadow-md scale-105' : 'opacity-70 hover:opacity-100'}`}
                            disabled={!selectedActivityId}
                          >
                            {opt.label}
                          </button>
                        ))}
                        
                        {/* 恢復(重置)按鈕：只有當有狀態時才顯示 */}
                        {currentStatus && selectedActivityId && (
                           <button
                             onClick={() => onDeleteAttendance(selectedActivityId, String(member.id))}
                             className="ml-2 px-2 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all flex items-center gap-1"
                             title="清除狀態 (重置)"
                           >
                             <RotateCcw size={14} />
                             <span className="hidden sm:inline">重置</span>
                           </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       {currentStatus && updatedAt && (
                         <div className="flex items-center justify-end gap-1 text-xs text-gray-400 font-mono">
                           <Clock size={12} />
                           {formatTime(updatedAt)}
                         </div>
                       )}
                    </td>
                  </tr>
                 );
              })}
            </tbody>
          </table>
        </div>
        {filteredMembers.length === 0 && (
          <div className="p-10 text-center text-gray-400">沒有找到符合的會員資料</div>
        )}
      </div>
    </div>
  );
};

export default AttendanceManager;
