
import React, { useState, useMemo } from 'react';
import { Calendar, Tag, Image as ImageIcon, Award, Camera, ChevronRight } from 'lucide-react';
import { Milestone, MilestoneType } from '../types';

interface MilestonesProps {
  milestones: Milestone[];
}

const Milestones: React.FC<MilestonesProps> = ({ milestones }) => {
  const [filter, setFilter] = useState<MilestoneType | 'all'>('all');

  const filteredMilestones = useMemo(() => {
    return filter === 'all' 
      ? milestones 
      : milestones.filter(m => m.type === filter);
  }, [milestones, filter]);

  const stats = useMemo(() => {
    return {
      total: milestones.length,
      activities: milestones.filter(m => m.type === MilestoneType.ACTIVITY).length,
      awards: milestones.filter(m => m.type === MilestoneType.AWARD).length,
    };
  }, [milestones]);

  return (
    <div className="pb-20">
      {/* Hero Section */}
      <section className="bg-white border-b py-16 px-4 mb-10">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 px-4 py-1.5 rounded-full text-sm font-bold mb-6">
            <Award size={16} />
            長展大事記
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-4 text-gray-900 tracking-tight">紀錄榮耀與精彩瞬間</h1>
          <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed">
            我們在這裡紀錄分會的成長點滴、精彩活動剪影以及獲得的各項殊榮。
            每一份紀錄都是我們共同努力的見證。
          </p>
          
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            <button 
              onClick={() => setFilter('all')}
              className={`px-6 py-2.5 rounded-full font-bold transition-all flex items-center gap-2 ${filter === 'all' ? 'bg-red-600 text-white shadow-lg shadow-red-100 scale-105' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              全部 ({stats.total})
            </button>
            <button 
              onClick={() => setFilter(MilestoneType.ACTIVITY)}
              className={`px-6 py-2.5 rounded-full font-bold transition-all flex items-center gap-2 ${filter === MilestoneType.ACTIVITY ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 scale-105' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <Camera size={18} />
              活動剪影 ({stats.activities})
            </button>
            <button 
              onClick={() => setFilter(MilestoneType.AWARD)}
              className={`px-6 py-2.5 rounded-full font-bold transition-all flex items-center gap-2 ${filter === MilestoneType.AWARD ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-100 scale-105' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <Award size={18} />
              得獎紀錄 ({stats.awards})
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredMilestones.map((milestone, index) => (
            <div 
              key={milestone.id} 
              className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                {milestone.image_url ? (
                  <img 
                    src={milestone.image_url} 
                    alt={milestone.title} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <ImageIcon size={48} strokeWidth={1} />
                  </div>
                )}
                <div className="absolute top-4 left-4">
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm ${
                    milestone.type === MilestoneType.AWARD ? 'bg-yellow-500 text-white' : 'bg-blue-600 text-white'
                  }`}>
                    {milestone.type}
                  </span>
                </div>
              </div>
              
              <div className="p-6">
                <div className="flex items-center gap-2 text-xs text-gray-400 font-bold mb-3">
                  <Calendar size={14} className="text-red-600" />
                  {milestone.date}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-red-600 transition-colors line-clamp-1">
                  {milestone.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed line-clamp-3">
                  {milestone.description}
                </p>
                
                <div className="mt-6 pt-4 border-t border-gray-50 flex justify-end">
                  <div className="text-red-600 text-xs font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                    查看詳情
                    <ChevronRight size={14} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredMilestones.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
              <ImageIcon size={40} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">目前尚無相關紀錄</h3>
            <p className="text-gray-400">請稍後再回來查看，我們將持續更新精彩內容。</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Milestones;
