
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, CheckCircle, DollarSign, Clock, FileDown, ChevronRight, Filter, X } from 'lucide-react';
import { Activity, Registration } from '../../types';

interface DashboardHomeProps {
  activities: Activity[];
  registrations: Registration[];
}

const DashboardHome: React.FC<DashboardHomeProps> = ({ activities, registrations }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 根據日期篩選活動
  const filteredActivities = activities.filter(activity => {
    if (startDate && activity.date < startDate) return false;
    if (endDate && activity.date > endDate) return false;
    return true;
  });

  // 根據篩選後的活動，找出相關的報名資料
  const filteredActivityIds = new Set(filteredActivities.map(a => String(a.id)));
  const filteredRegistrations = registrations.filter(r => filteredActivityIds.has(String(r.activityId)));

  // 計算活動統計資料
  const activityStats = filteredActivities.map(activity => {
    const activityRegs = registrations.filter(r => String(r.activityId) === String(activity.id));
    const checkedIn = activityRegs.filter(r => r.check_in_status === true).length; 
    const revenue = activityRegs.reduce((sum, r) => sum + (r.paid_amount || 0), 0);
    const rate = activityRegs.length > 0 ? Math.round((checkedIn / activityRegs.length) * 100) : 0;
    
    return {
      ...activity,
      regCount: activityRegs.length,
      checkedInCount: checkedIn,
      checkInRate: rate,
      revenue
    };
  });

  const activeActivitiesCount = filteredActivities.filter(a => !a.status || a.status === 'active').length;
  const totalRevenue = filteredRegistrations.reduce((sum, reg) => sum + (reg.paid_amount || 0), 0);
  const checkedInCount = filteredRegistrations.filter(r => r.check_in_status).length;

  const handleSingleExport = (activity: Activity) => {
    const targetRegs = registrations.filter(r => String(r.activityId) === String(activity.id));
    if (targetRegs.length === 0) {
      alert(`「${activity.title}」目前尚無報名資料，無法匯出。`);
      return;
    }
    let csvContent = '\uFEFF';
    const headers = ['活動名稱', '日期', '姓名', '電話', 'Email', '公司', '職稱', '引薦人', '繳費金額', '報到狀態', '報名時間'];
    csvContent += headers.join(',') + '\n';
    targetRegs.forEach(reg => {
      const checkIn = reg.check_in_status ? '已報到' : '未報到';
      const paid = reg.paid_amount || 0;
      const regTime = new Date(reg.created_at).toLocaleString('zh-TW');
      const escape = (text: string | undefined) => {
        if (!text) return '""';
        return `"${text.replace(/"/g, '""')}"`;
      };
      const row = [
        escape(activity.title),
        escape(activity.date),
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
    link.href = url;
    link.setAttribute('download', `${activity.date}_${activity.title}_報名名單.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">活動數據儀表板</h1>
          <p className="text-gray-500">掌握各場活動的報名與收益狀況。</p>
        </div>
        
        {/* 日期篩選器 */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 px-2">
            <Filter size={16} className="text-gray-400" />
            <span className="text-sm font-bold text-gray-500">日期區間</span>
          </div>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
          />
          <span className="text-gray-400 text-xs">至</span>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
          />
          {(startDate || endDate) && (
            <button 
              onClick={clearFilter}
              className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-colors"
              title="清除篩選"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* 總覽卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">總活動場次</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">{activeActivitiesCount}</h3>
            </div>
            <div className="p-3 bg-red-50 text-red-600 rounded-xl"><Calendar size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">總報名人數</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">{filteredRegistrations.length}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">總報到人數</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">{checkedInCount}</h3>
            </div>
            <div className="p-3 bg-green-50 text-green-600 rounded-xl"><CheckCircle size={24} /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">總營收 (已繳費)</p>
               <h3 className="text-3xl font-bold text-gray-900 mt-2">NT$ {totalRevenue.toLocaleString()}</h3>
             </div>
             <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl"><DollarSign size={24} /></div>
           </div>
        </div>
      </div>

      {/* 活動列表與詳細數據 */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-gray-800">各活動報名狀況</h2>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-8 py-6 w-1/3">活動名稱 / 時間</th>
                  <th className="px-6 py-6">報名人數</th>
                  <th className="px-6 py-6">實收金額</th>
                  <th className="px-6 py-6">報到進度</th>
                  <th className="px-6 py-6">報到率</th>
                  <th className="px-8 py-6 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activityStats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center text-gray-400">
                      在此日期區間內無活動資料
                    </td>
                  </tr>
                ) : (
                  activityStats.map(stat => (
                    <tr key={stat.id} className="hover:bg-red-50/30 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="font-bold text-gray-900 text-lg">{stat.title}</div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1 font-medium">
                          <Calendar size={12} className="text-red-600" />
                          {stat.date}
                          <Clock size={12} className="text-red-600 ml-2" />
                          {stat.time}
                          <span className="mx-1">•</span>
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500">{stat.type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="text-2xl font-bold text-gray-800">{stat.regCount}</div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="text-xl font-bold text-red-600">NT$ {stat.revenue.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="text-lg font-bold text-gray-700">
                          {stat.checkedInCount} <span className="text-gray-300 font-normal">/</span> {stat.regCount}
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className={`text-xl font-black ${stat.checkInRate > 80 ? 'text-green-600' : stat.checkInRate > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                          {stat.checkInRate}%
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button 
                            onClick={() => handleSingleExport(stat)}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-all shadow-sm"
                            title="匯出此活動報名表"
                          >
                            <FileDown size={20} />
                          </button>
                          <Link 
                            to="/admin/check-in" 
                            state={{ activityId: stat.id }}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-400 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                            title="進入報到管理"
                          >
                            <ChevronRight size={20} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardHome;
