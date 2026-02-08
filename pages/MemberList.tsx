
import React, { useState } from 'react';
import { Globe, Building2, User, Tag } from 'lucide-react';
import { Member } from '../types';

interface MemberListProps {
  members: Member[];
}

const MemberList: React.FC<MemberListProps> = ({ members }) => {
  const [filter, setFilter] = useState<string>('all');
  const chains = ['美食', '工程', '健康', '幸福', '工商'];

  // 僅顯示活躍會員
  const activeMembers = members.filter(m => m.status === undefined || m.status === 'active');

  // 排序：依照會員編號 (若有) 或 ID
  const sortedMembers = [...activeMembers].sort((a, b) => {
    const valA = a.member_no !== undefined && a.member_no !== null ? String(a.member_no) : '';
    const valB = b.member_no !== undefined && b.member_no !== null ? String(b.member_no) : '';
    
    // 如果兩者都沒有編號，保持原順序或用 ID 排
    if (!valA && !valB) return 0;
    if (!valA) return 1;
    if (!valB) return -1;

    return valA.localeCompare(valB, undefined, { numeric: true });
  });

  const filteredMembers = filter === 'all' 
    ? sortedMembers 
    : sortedMembers.filter(m => m.industry_chain === filter);

  // 取得卡片樣式：背景色、邊框色、標籤樣式
  const getCardStyle = (chain: string) => {
    switch (chain) {
      case '美食':
        return {
          card: 'bg-orange-50 border-orange-200 hover:shadow-orange-100',
          badge: 'bg-white text-orange-600 shadow-sm border border-orange-100',
          hoverText: 'group-hover:text-orange-700',
          buttonBg: 'bg-white hover:bg-orange-600 hover:text-white text-orange-600'
        };
      case '工程':
        return {
          card: 'bg-sky-50 border-sky-200 hover:shadow-sky-100',
          badge: 'bg-white text-sky-600 shadow-sm border border-sky-100',
          hoverText: 'group-hover:text-sky-700',
          buttonBg: 'bg-white hover:bg-sky-600 hover:text-white text-sky-600'
        };
      case '健康':
        return {
          card: 'bg-emerald-50 border-emerald-200 hover:shadow-emerald-100',
          badge: 'bg-white text-emerald-600 shadow-sm border border-emerald-100',
          hoverText: 'group-hover:text-emerald-700',
          buttonBg: 'bg-white hover:bg-emerald-600 hover:text-white text-emerald-600'
        };
      case '幸福':
        return {
          card: 'bg-rose-50 border-rose-200 hover:shadow-rose-100',
          badge: 'bg-white text-rose-600 shadow-sm border border-rose-100',
          hoverText: 'group-hover:text-rose-700',
          buttonBg: 'bg-white hover:bg-rose-600 hover:text-white text-rose-600'
        };
      case '工商':
        return {
          card: 'bg-purple-50 border-purple-200 hover:shadow-purple-100',
          badge: 'bg-white text-purple-600 shadow-sm border border-purple-100',
          hoverText: 'group-hover:text-purple-700',
          buttonBg: 'bg-white hover:bg-purple-600 hover:text-white text-purple-600'
        };
      default:
        return {
          card: 'bg-white border-gray-100 hover:shadow-lg',
          badge: 'bg-gray-100 text-gray-600',
          hoverText: 'group-hover:text-red-600',
          buttonBg: 'bg-gray-50 hover:bg-red-600 hover:text-white text-gray-600'
        };
    }
  };

  return (
    <div className="pb-20">
      {/* Hero Section */}
      <section className="bg-white border-b py-16 px-4 mb-10">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-4 text-gray-900">分會成員介紹</h1>
          <p className="text-gray-500 max-w-2xl mx-auto">匯聚各產業菁英，打造最強商務連結。點擊下方分類快速尋找合作夥伴。</p>
          
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <button 
              onClick={() => setFilter('all')}
              className={`px-5 py-2 rounded-full font-bold transition-all ${filter === 'all' ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              全部
            </button>
            {chains.map(chain => (
              <button 
                key={chain}
                onClick={() => setFilter(chain)}
                className={`px-5 py-2 rounded-full font-bold transition-all ${filter === chain ? 'bg-gray-900 text-white shadow-lg' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {chain}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMembers.map(member => {
            const style = getCardStyle(member.industry_chain);
            return (
              <div key={member.id} className={`rounded-2xl border p-6 hover:shadow-xl transition-all duration-300 group flex flex-col ${style.card}`}>
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex flex-wrap items-center gap-2 pr-2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${style.badge}`}>
                      {member.industry_chain}
                    </span>
                    {/* 行業別改為半透明白色背景，增加層次 */}
                    <span className="text-xs font-medium text-gray-500 bg-white/60 border border-white/50 px-3 py-1 rounded-full">
                      {member.industry_category}
                    </span>
                  </div>
                  {member.member_no !== undefined && member.member_no !== null && (
                    <span className="text-xs font-mono text-gray-400 font-bold whitespace-nowrap opacity-60">#{member.member_no}</span>
                  )}
                </div>
                
                <div className="flex-grow">
                  <h3 className={`text-xl font-bold text-gray-900 mb-3 transition-colors ${style.hoverText}`}>{member.company}</h3>
                  
                  <div className="flex items-center gap-2 text-gray-700 font-medium mb-3">
                    <User size={16} className="opacity-50" />
                    {member.name}
                  </div>

                  {/* 顯示簡介 */}
                  {member.intro && (
                    <p className="text-sm text-gray-500 mb-4 line-clamp-3 leading-relaxed">
                      {member.intro}
                    </p>
                  )}
                </div>

                <div className="mt-auto pt-4 border-t border-black/5">
                  {member.website ? (
                    <a 
                      href={member.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${style.buttonBg}`}
                    >
                      <Globe size={16} />
                      參觀網站
                    </a>
                  ) : (
                    <button disabled className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/50 text-gray-400 text-sm font-bold cursor-not-allowed border border-transparent">
                      <Globe size={16} />
                      暫無網站
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredMembers.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
              <User size={32} />
            </div>
            <p className="text-gray-400 font-bold">此分類目前尚無成員資料</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberList;
