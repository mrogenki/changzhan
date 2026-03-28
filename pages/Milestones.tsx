
import React, { useState, useMemo } from 'react';
import { Calendar, Tag, Image as ImageIcon, Award, Camera, ChevronRight, X, ChevronLeft, Maximize2 } from 'lucide-react';
import { Milestone, MilestoneType } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface MilestonesProps {
  milestones: Milestone[];
}

const Milestones: React.FC<MilestonesProps> = ({ milestones }) => {
  const [filter, setFilter] = useState<MilestoneType | 'all'>('all');
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const filteredMilestones = useMemo(() => {
    const filtered = filter === 'all' 
      ? milestones 
      : milestones.filter(m => m.type === filter);
    
    // Sort by date descending
    return [...filtered].sort((a, b) => b.date.localeCompare(a.date));
  }, [milestones, filter]);

  // Group by year
  const groupedMilestones = useMemo(() => {
    const groups: { [key: string]: Milestone[] } = {};
    filteredMilestones.forEach(m => {
      const year = m.date.split('-')[0];
      if (!groups[year]) groups[year] = [];
      groups[year].push(m);
    });
    return Object.entries(groups).sort(([yearA], [yearB]) => yearB.localeCompare(yearA));
  }, [filteredMilestones]);

  const stats = useMemo(() => {
    return {
      total: milestones.length,
      activities: milestones.filter(m => m.type === MilestoneType.ACTIVITY).length,
      awards: milestones.filter(m => m.type === MilestoneType.AWARD).length,
    };
  }, [milestones]);

  const openGallery = (milestone: Milestone) => {
    setSelectedMilestone(milestone);
    setActiveImageIndex(0);
  };

  const closeGallery = () => {
    setSelectedMilestone(null);
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedMilestone?.images) return;
    setActiveImageIndex((prev) => (prev + 1) % (selectedMilestone.images?.length || 1));
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedMilestone?.images) return;
    setActiveImageIndex((prev) => (prev - 1 + (selectedMilestone.images?.length || 1)) % (selectedMilestone.images?.length || 1));
  };

  const allImages = useMemo(() => {
    if (!selectedMilestone) return [];
    const imgs = [];
    if (selectedMilestone.image_url) imgs.push(selectedMilestone.image_url);
    if (selectedMilestone.images) imgs.push(...selectedMilestone.images);
    // Remove duplicates
    return Array.from(new Set(imgs));
  }, [selectedMilestone]);

  return (
    <div className="pb-20 bg-gray-50/30 min-h-screen">
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Timeline Line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-red-100 -translate-x-1/2 hidden md:block" />

        <div className="space-y-16">
          {groupedMilestones.map(([year, items]) => (
            <div key={year} className="relative">
              {/* Year Marker */}
              <div className="flex justify-center mb-12 sticky top-20 z-10">
                <div className="bg-red-600 text-white px-8 py-2 rounded-full font-black text-xl shadow-xl shadow-red-200 tracking-widest">
                  {year}
                </div>
              </div>

              <div className="space-y-12">
                {items.map((milestone, idx) => (
                  <motion.div 
                    key={milestone.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    className={`flex flex-col md:flex-row items-center gap-8 ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
                  >
                    {/* Content Card */}
                    <div className={`w-full md:w-[45%] ${idx % 2 === 1 ? 'md:text-right' : 'md:text-left'}`}>
                      <div 
                        onClick={() => openGallery(milestone)}
                        className="group bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-500 cursor-pointer"
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
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="bg-white/90 p-3 rounded-full text-red-600 transform scale-75 group-hover:scale-100 transition-transform">
                              <Maximize2 size={24} />
                            </div>
                          </div>
                          <div className="absolute top-4 left-4">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm ${
                              milestone.type === MilestoneType.AWARD ? 'bg-yellow-500 text-white' : 'bg-blue-600 text-white'
                            }`}>
                              {milestone.type}
                            </span>
                          </div>
                        </div>
                        
                        <div className="p-6">
                          <div className={`flex items-center gap-2 text-xs text-gray-400 font-bold mb-3 ${idx % 2 === 1 ? 'md:justify-end' : ''}`}>
                            <Calendar size={14} className="text-red-600" />
                            {milestone.date}
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-red-600 transition-colors">
                            {milestone.title}
                          </h3>
                          <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">
                            {milestone.description}
                          </p>
                          
                          {(milestone.images?.length || 0) > 0 && (
                            <div className={`mt-4 flex items-center gap-1 text-[10px] font-bold text-gray-400 ${idx % 2 === 1 ? 'md:justify-end' : ''}`}>
                              <ImageIcon size={12} />
                              包含 {milestone.images?.length} 張更多照片
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Timeline Dot */}
                    <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-white border-4 border-red-600 shadow-lg z-10 relative">
                      <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                    </div>

                    {/* Spacer for the other side */}
                    <div className="hidden md:block w-[45%]" />
                  </motion.div>
                ))}
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

      {/* Gallery Modal */}
      <AnimatePresence>
        {selectedMilestone && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
            onClick={closeGallery}
          >
            <div className="flex justify-between items-center p-6 text-white">
              <div>
                <h2 className="text-xl font-bold">{selectedMilestone.title}</h2>
                <p className="text-sm text-gray-400">{selectedMilestone.date}</p>
              </div>
              <button 
                onClick={closeGallery}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={32} />
              </button>
            </div>

            <div className="flex-grow relative flex items-center justify-center p-4 md:p-10">
              {allImages.length > 0 ? (
                <>
                  <motion.img 
                    key={activeImageIndex}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    src={allImages[activeImageIndex]} 
                    className="max-w-full max-h-full object-contain shadow-2xl"
                    referrerPolicy="no-referrer"
                    onClick={(e) => e.stopPropagation()}
                  />

                  {allImages.length > 1 && (
                    <>
                      <button 
                        onClick={prevImage}
                        className="absolute left-4 md:left-10 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all"
                      >
                        <ChevronLeft size={32} />
                      </button>
                      <button 
                        onClick={nextImage}
                        className="absolute right-4 md:right-10 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all"
                      >
                        <ChevronRight size={32} />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="text-gray-500 flex flex-col items-center gap-4">
                  <ImageIcon size={64} />
                  <p>暫無照片</p>
                </div>
              )}
            </div>

            {allImages.length > 1 && (
              <div className="p-6 overflow-x-auto">
                <div className="flex justify-center gap-2">
                  {allImages.map((img, idx) => (
                    <button 
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); setActiveImageIndex(idx); }}
                      className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${activeImageIndex === idx ? 'border-red-600 scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                    >
                      <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-6 bg-black/50 text-white text-center">
              <p className="max-w-3xl mx-auto text-sm leading-relaxed">
                {selectedMilestone.description}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Milestones;
