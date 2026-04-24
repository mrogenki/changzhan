import React, { useState, useEffect } from 'react';
import { Search, FileDown, CheckCircle, XCircle, Trash2, RefreshCw } from 'lucide-react';
import { Activity, Registration } from '../../types';
import PaidAmountInput from './PaidAmountInput';

interface CheckInManagerProps {
  activities: Activity[];
  registrations: Registration[];
  onUpdateRegistration: (reg: Registration) => void;
  onDeleteRegistration: (id: string | number) => void;
  onRefreshRegistrations: () => Promise<void>;
}

const CheckInManager: React.FC<CheckInManagerProps> = ({ activities, registrations, onUpdateRegistration, onDeleteRegistration, onRefreshRegistrations }) => {
  const [selectedActivityId, setSelectedActivityId] = useState<string>(activities.length > 0 ? String(activities[0].id) : '');
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!selectedActivityId && activities.length > 0) {
      setSelectedActivityId(String(activities[0].id));
    }
  }, [activities]);

  const filteredRegistrations = registrations.filter(r => {
    const matchesActivity = selectedActivityId === 'all' || String(r.activityId) === selectedActivityId;
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.phone.includes(searchTerm) ||
                          r.company?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesActivity && matchesSearch;
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshRegistrations();
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = () => {
    if (filteredRegistrations.length === 0) {
      alert('目前列表無資料可匯出');
      return;
    }
    let csvContent = '\uFEFF';
    const headers = ['活動名稱', '日期', '姓名', '電話', 'Email', '公司', '職稱', '引薦人', '繳費金額', '報到狀態', '報名時間'];
    csvContent += headers.join(',') + '\n';

    filteredRegistrations.forEach(reg => {
      const activity = activities.find(a => String(a.id) === String(reg.activityId));
      const actTitle = activity ? activity.title : '未知活動';
      const actDate = activity ? activity.date : '';
      const checkIn = reg.check_in_status ? '已報到' : '未報到';
      const paid = reg.paid_amount || 0;
      const regTime = new Date(reg.created_at).toLocaleString('zh-TW');

      const escape = (text: string | undefined) => {
        if (!text) return '""';
        return `"${text.replace(/"/g, '""')}"`;
      };

      const row = [
        escape(actTitle),
        escape(actDate),
        escape(reg.name),
        escape(reg.phone),
        escape(reg.email),
        escape(reg.company),
        escape(reg.title),
        escape(reg.referrer),
        paid,
        escape(checkIn),
        escape(regTime)
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    let filename = '活動報名名單.csv';
    if (selectedActivityId !== 'all') {
      const act = activities.find(a => String(a.id) === String(selectedActivityId));
      if (act) {
        filename = `${act.date}_${act.title}_報名名單.csv`;
      }
    } else {
      const dateStr = new Date().toISOString().split('T')[0];
      filename = `所有活動報名名單_${dateStr}.csv`;
    }

    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold">報到管理 (訪客)</h1>
           <p className="text-gray-500 text-sm">管理活動報名人員的報到狀態與繳費紀錄。</p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-3 rounded-xl hover:bg-blue-100 transition-all shadow-sm active:scale-95 whitespace-nowrap disabled:opacity-50"
            title="重新載入報到狀態"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''}/>
            {refreshing ? '更新中...' : '重整報到'}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-xl hover:bg-green-700 transition-all shadow-sm active:scale-95 whitespace-nowrap"
          >
            <FileDown size={18}/> 匯出報名表
          </button>
          <select
            value={selectedActivityId}
            onChange={e => setSelectedActivityId(e.target.value)}
            className="w-full md:w-64 border rounded-xl px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-red-500 font-bold"
          >
            <option value="all">所有活動</option>
            {activities.map(a => (
              <option key={a.id} value={a.id}>{a.date} {a.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              placeholder="搜尋姓名、電話或公司..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent outline-none text-sm w-full sm:w-64"
            />
          </div>
          <div className="flex gap-4 text-sm font-bold text-gray-500">
             <span>報名：{filteredRegistrations.length}</span>
             <span className="text-green-600">已報到：{filteredRegistrations.filter(r => r.check_in_status).length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">姓名 / 公司</th>
                <th className="px-6 py-4">聯絡資訊</th>
                <th className="px-6 py-4">報到狀態</th>
                <th className="px-6 py-4">繳費金額</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRegistrations.map(reg => (
                <tr key={reg.id} className={`hover:bg-gray-50/50 transition-colors ${reg.check_in_status ? 'bg-green-50/10' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{reg.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{reg.company} {reg.title && ` - ${reg.title}`}</div>
                    {reg.referrer && <div className="text-xs text-red-400 mt-1">引薦人: {reg.referrer}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-mono text-gray-600">{reg.phone}</div>
                    <div className="text-xs text-gray-400">{reg.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => onUpdateRegistration({...reg, check_in_status: !reg.check_in_status})}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        reg.check_in_status
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {reg.check_in_status ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {reg.check_in_status ? '已報到' : '未報到'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">$</span>
                      <PaidAmountInput
                        value={reg.paid_amount}
                        onSave={(val) => onUpdateRegistration({...reg, paid_amount: val})}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => { if(window.confirm('確定要刪除此報名紀錄嗎？')) onDeleteRegistration(reg.id); }}
                      className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRegistrations.length === 0 && (
             <div className="p-10 text-center text-gray-400">目前尚無報名資料</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckInManager;
