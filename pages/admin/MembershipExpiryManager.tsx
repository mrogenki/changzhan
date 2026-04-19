import React, { useState, useMemo } from 'react';
import { CalendarClock, Search, Filter, Phone, Building2, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { Member } from '../../types';

interface MembershipExpiryManagerProps {
  members: Member[];
}

const parseDate = (dateStr?: string): { year: number; month: number; day: number } | null => {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return {
    year: parseInt(m[1], 10),
    month: parseInt(m[2], 10),
    day: parseInt(m[3], 10),
  };
};

/**
 * 依 end_date 判斷目前會籍狀態：
 * - inactive → 停權/離會
 * - end_date 已過今天 → 已過期
 * - 距離到期日 ≤ 30 天 → 即將到期
 * - 其他 → 有效
 */
const getExpiryStatus = (member: Member): {
  label: string;
  className: string;
  daysLeft?: number;
} => {
  if (member.status === 'inactive') {
    return { label: '停權/離會', className: 'bg-gray-200 text-gray-600' };
  }
  if (!member.end_date) {
    return { label: '未設定', className: 'bg-gray-100 text-gray-400' };
  }
  const end = new Date(member.end_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = end.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) {
    return { label: '已過期', className: 'bg-red-100 text-red-700', daysLeft };
  }
  if (daysLeft <= 30) {
    return { label: '即將到期', className: 'bg-orange-100 text-orange-700', daysLeft };
  }
  return { label: '有效', className: 'bg-green-100 text-green-700', daysLeft };
};

const MembershipExpiryManager: React.FC<MembershipExpiryManagerProps> = ({ members }) => {
  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [searchQuery, setSearchQuery] = useState('');

  // 計算各月份會籍到期人數
  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 1; i <= 12; i++) counts[i] = 0;
    members.forEach(m => {
      const d = parseDate(m.end_date);
      if (d) counts[d.month] = (counts[d.month] || 0) + 1;
    });
    return counts;
  }, [members]);

  // 篩選
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members
      .filter(m => {
        const d = parseDate(m.end_date);
        if (!d) return false;
        if (d.month !== selectedMonth) return false;
        if (!q) return true;
        return (
          m.name?.toLowerCase().includes(q) ||
          String(m.member_no || '').toLowerCase().includes(q) ||
          m.company?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const da = parseDate(a.end_date)!;
        const db = parseDate(b.end_date)!;
        // 先依年份，再依日期
        if (da.year !== db.year) return da.year - db.year;
        return da.day - db.day;
      });
  }, [members, selectedMonth, searchQuery]);

  // 統計本月已過期/即將到期數量（提示用）
  const expiredCount = filteredMembers.filter(m => {
    const s = getExpiryStatus(m);
    return s.label === '已過期';
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
            <CalendarClock className="text-red-600" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">會員會籍管理</h1>
            <p className="text-sm text-gray-500">依月份查看會籍到期會員，提醒續約</p>
          </div>
        </div>
      </div>

      {/* 月份篩選 + 搜尋列 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Filter size={16} className="text-gray-400" />
            <span className="text-sm font-bold text-gray-700 whitespace-nowrap">選擇月份：</span>
          </div>

          <div className="flex flex-wrap gap-2 flex-grow">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
              <button
                key={month}
                onClick={() => setSelectedMonth(month)}
                className={`relative px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  selectedMonth === month
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100'
                }`}
              >
                {month}月
                {monthCounts[month] > 0 && (
                  <span
                    className={`ml-1.5 inline-flex items-center justify-center text-[10px] font-bold ${
                      selectedMonth === month ? 'text-white/80' : 'text-gray-400'
                    }`}
                  >
                    ({monthCounts[month]})
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative lg:w-64 shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜尋姓名、編號..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* 統計 + 告警提示 */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="text-sm text-gray-500">
          {selectedMonth} 月共有 <span className="font-bold text-red-600 text-base mx-1">{filteredMembers.length}</span> 位會員到期
        </div>
        {expiredCount > 0 && (
          <div className="flex items-center gap-2 bg-red-50 text-red-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-red-100">
            <AlertTriangle size={14} />
            其中 {expiredCount} 位已過期，請盡速聯繫
          </div>
        )}
      </div>

      {/* 會籍到期列表 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              <th className="px-6 py-4">會員編號</th>
              <th className="px-6 py-4">姓名</th>
              <th className="px-6 py-4">到期日</th>
              <th className="px-6 py-4">狀態</th>
              <th className="px-6 py-4">聯絡方式</th>
              <th className="px-6 py-4">公司 / 行業別</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredMembers.map(member => {
              const status = getExpiryStatus(member);
              return (
                <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-gray-700">
                    {String(member.member_no || '-').padStart(5, '0')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 border border-gray-100 flex-shrink-0">
                        {member.picture ? (
                          <img src={member.picture} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <ImageIcon size={14} />
                          </div>
                        )}
                      </div>
                      <span className="font-bold text-gray-900">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 text-gray-700">
                        <CalendarClock size={14} className="text-red-400" />
                        <span className="font-mono text-sm">{member.end_date}</span>
                      </div>
                      {status.daysLeft !== undefined && (
                        <span className={`text-[10px] mt-0.5 ml-6 ${
                          status.daysLeft < 0 ? 'text-red-500' :
                          status.daysLeft <= 30 ? 'text-orange-500' :
                          'text-gray-400'
                        }`}>
                          {status.daysLeft < 0
                            ? `已過期 ${Math.abs(status.daysLeft)} 天`
                            : status.daysLeft === 0
                            ? '今天到期'
                            : `剩餘 ${status.daysLeft} 天`}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {member.mobile_phone ? (
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Phone size={12} className="text-gray-400" />
                        <a href={`tel:${member.mobile_phone}`} className="font-mono hover:text-red-600">
                          {member.mobile_phone}
                        </a>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900 text-sm">{member.company || '-'}</div>
                    {member.industry_category && (
                      <div className="text-xs text-gray-400 mt-0.5">{member.industry_category}</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredMembers.length === 0 && (
          <div className="p-12 text-center">
            <CalendarClock size={32} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 font-medium">
              {searchQuery ? '查無符合條件的會員' : `${selectedMonth} 月沒有到期會員`}
            </p>
            {!searchQuery && (
              <p className="text-xs text-gray-400 mt-1">
                如果預期應該有會員到期，請檢查會員資料的「會籍到期日」欄位是否已填寫
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MembershipExpiryManager;
