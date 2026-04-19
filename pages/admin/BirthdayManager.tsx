import React, { useState, useMemo } from 'react';
import { Cake, Search, Filter, Phone, Mail, Building2, User as UserIcon, Image as ImageIcon } from 'lucide-react';
import { Member } from '../../types';

interface BirthdayManagerProps {
  members: Member[];
}

/**
 * 解析 YYYY-MM-DD 字串，回傳 { year, month, day }
 * month 為 1~12（非 0-indexed）
 */
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
 * 會籍狀態計算：
 * - inactive → 停權/離會
 * - end_date 存在且早於今天 → 已過期
 * - 否則 → 有效
 */
const getMembershipStatus = (member: Member): {
  label: string;
  className: string;
} => {
  if (member.status === 'inactive') {
    return { label: '停權/離會', className: 'bg-gray-200 text-gray-600' };
  }
  if (member.end_date) {
    const end = new Date(member.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (end < today) {
      return { label: '已過期', className: 'bg-gray-100 text-gray-500' };
    }
  }
  return { label: '有效', className: 'bg-green-100 text-green-700' };
};

const BirthdayManager: React.FC<BirthdayManagerProps> = ({ members }) => {
  // 預設為當前月份
  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [searchQuery, setSearchQuery] = useState('');

  // 計算各月份壽星人數（供 badge 顯示）
  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 1; i <= 12; i++) counts[i] = 0;
    members.forEach(m => {
      const d = parseDate(m.birthday);
      if (d) counts[d.month] = (counts[d.month] || 0) + 1;
    });
    return counts;
  }, [members]);

  // 依月份篩選 + 搜尋
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members
      .filter(m => {
        const d = parseDate(m.birthday);
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
        // 依日期升冪
        const da = parseDate(a.birthday)!;
        const db = parseDate(b.birthday)!;
        return da.day - db.day;
      });
  }, [members, selectedMonth, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
            <Cake className="text-red-600" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">會員生日管理</h1>
            <p className="text-sm text-gray-500">依月份查看會員壽星名單</p>
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

      {/* 統計 */}
      <div className="text-sm text-gray-500">
        {selectedMonth} 月共有 <span className="font-bold text-red-600 text-base mx-1">{filteredMembers.length}</span> 位壽星
      </div>

      {/* 壽星列表 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              <th className="px-6 py-4">會員編號</th>
              <th className="px-6 py-4">姓名</th>
              <th className="px-6 py-4">生日</th>
              <th className="px-6 py-4">狀態</th>
              <th className="px-6 py-4">聯絡方式</th>
              <th className="px-6 py-4">公司 / 行業別</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredMembers.map(member => {
              const status = getMembershipStatus(member);
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
                    <div className="flex items-center gap-2 text-gray-600">
                      <Cake size={14} className="text-red-400" />
                      <span className="font-mono text-sm">{member.birthday}</span>
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
            <Cake size={32} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 font-medium">
              {searchQuery ? '查無符合條件的會員' : `${selectedMonth} 月沒有壽星`}
            </p>
            {!searchQuery && (
              <p className="text-xs text-gray-400 mt-1">
                如果預期應該有壽星，請檢查會員資料的「生日」欄位是否已填寫
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BirthdayManager;
