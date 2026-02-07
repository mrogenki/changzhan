
import React, { useState } from 'react';
import { Globe, Building2, User, Tag } from 'lucide-react';
import { Member } from '../types';

interface MemberListProps {
  members: Member[];
}

const MemberList: React.FC<MemberListProps> = ({ members }) => {
  const [filter, setFilter] = useState<string>('all');
  const chains = ['美食', '工程', '健康', '幸福', '工商'];

  // 排序：依照會員編號 (若有) 或 ID
  // 修正：將 member_no 轉為字串後再比較，並啟用數值模式 ({numeric: true})
  const sortedMembers = [...members].sort((a, b) => {
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

  // 產業鏈顏色對照
  const getChainColor = (chain: string) => {
    switch (chain) {
      case '美食': return 'bg-orange-100 text-orange-600';
      case '工程': return 'bg-blue-100 text-blue-600';
      case '健康': return 'bg-green-100 text-green-600';
      case '幸福': return 'bg-pink-100 text-pink-600';
      case '工商': return 'bg-purple-100 text-purple-600';
      default: return 'bg-gray-100 text-gray-600';
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
          {filteredMembers.map(member => (
            <div key={member.id} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 group flex flex-col">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex flex-wrap items-center gap-2 pr-2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${getChainColor(member.industry_chain)}`}>
                    {member.industry_chain}
                  </span>
                  <span className="text-xs font-medium text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">
                    {member.industry_category}
                  </span>
                </div>
                {member.member_no !== undefined && member.member_no !== null && (
                  <span className="text-xs font-mono text-gray-300 font-bold whitespace-nowrap">#{member.member_no}</span>
                )}
              </div>
              
              <div className="flex-grow">
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-red-600 transition-colors">{member.company}</h3>
                {/* 行業別已移動至上方 */}
                
                <div className="flex items-center gap-2 text-gray-700 font-medium mb-3">
                  <User size={16} className="text-red-600" />
                  {member.name}
                </div>

                {/* 顯示簡介 */}
                {member.intro && (
                  <p className="text-sm text-gray-500 mb-4 line-clamp-3 leading-relaxed">
                    {member.intro}
                  </p>
                )}
              </div>

              <div className="mt-auto pt-4 border-t border-gray-50">
                {member.website ? (
                  <a 
                    href={member.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gray-50 text-gray-600 text-sm font-bold hover:bg-red-600 hover:text-white transition-all"
                  >
                    <Globe size={16} />
                    參觀網站
                  </a>
                ) : (
                  <button disabled className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gray-50 text-gray-300 text-sm font-bold cursor-not-allowed">
                    <Globe size={16} />
                    暫無網站
                  </button>
                )}
              </div>
            </div>
          ))}
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
