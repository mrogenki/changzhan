import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, DollarSign, ChevronRight, Clock, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Activity, ActivityType } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HomeProps {
  activities: Activity[];
}

const ActivityCard: React.FC<{ activity: Activity }> = ({ activity }) => (
  <Link to={`/activity/${activity.id}`} className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
    <div className="relative aspect-video overflow-hidden">
      <img src={activity.picture} alt={activity.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
      <div className="absolute top-4 left-4">
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${activity.type === ActivityType.REGULAR ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'}`}>
          {activity.type}
        </span>
      </div>
    </div>
    <div className="p-6">
      <h3 className="text-xl font-bold mb-4 line-clamp-1 group-hover:text-red-600 transition-colors">{activity.title}</h3>
      <div className="space-y-2 text-sm text-gray-500 mb-6">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-red-600" />
          <span>{activity.date}</span>
          <Clock size={16} className="text-red-600 ml-2" />
          <span>{activity.time}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-red-600" />
          <span className="line-clamp-1">{activity.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-red-600" />
          <span>NT$ {activity.price.toLocaleString()}</span>
        </div>
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
        <span className="text-red-600 font-bold text-sm">立即報名</span>
        <ChevronRight size={18} className="text-red-600" />
      </div>
    </div>
  </Link>
);

const HeroCarousel: React.FC<{ activities: Activity[] }> = ({ activities }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (activities.length <= 1) return;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % activities.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [activities.length]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0
    })
  };

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setCurrentIndex((prev) => (prev + newDirection + activities.length) % activities.length);
  };

  if (activities.length === 0) {
    return (
      <section className="bg-red-600 text-white py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6">連結、成長、共好</h1>
          <p className="text-xl text-red-100 max-w-2xl">長展分會提供最專業的商務媒合與人脈交流活動，讓您的事業在這裡展翅高飛。</p>
        </div>
      </section>
    );
  }

  const currentActivity = activities[currentIndex];

  return (
    <section className="relative w-full overflow-hidden bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="relative aspect-video w-full">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
              className="absolute inset-0"
            >
              <div className="relative w-full h-full">
                <img 
                  src={currentActivity.picture} 
                  alt={currentActivity.title}
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 md:p-16">
                  <div className="max-w-3xl space-y-4">
                    <motion.span 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="inline-block px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full uppercase tracking-widest"
                    >
                      {currentActivity.type}
                    </motion.span>
                    <motion.h2 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-3xl md:text-5xl lg:text-6xl font-black text-white leading-tight"
                    >
                      {currentActivity.title}
                    </motion.h2>
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="flex flex-wrap gap-4 text-gray-200 text-sm md:text-base font-medium"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-red-500" />
                        <span>{currentActivity.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={18} className="text-red-500" />
                        <span>{currentActivity.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={18} className="text-red-500" />
                        <span className="line-clamp-1">{currentActivity.location}</span>
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="pt-4"
                    >
                      <Link 
                        to={`/activity/${currentActivity.id}`}
                        className="inline-flex items-center gap-2 bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-red-600 hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-xl"
                      >
                        立即報名 <ChevronRight size={20} />
                      </Link>
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          {activities.length > 1 && (
            <>
              <button
                onClick={() => paginate(-1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={() => paginate(1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all"
              >
                <ChevronRight size={24} />
              </button>
              
              {/* Dots */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                {activities.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setDirection(idx > currentIndex ? 1 : -1);
                      setCurrentIndex(idx);
                    }}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      idx === currentIndex ? "bg-red-600 w-8" : "bg-white/40 hover:bg-white/60"
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

// 各活動類型的顯示設定（順序、標題、副標題、顏色）
const TYPE_SECTIONS: Array<{
  type: ActivityType;
  title: string;
  subtitle: string;
  barColor: string;
}> = [
  {
    type: ActivityType.REGULAR_MEETING,
    title: '例會活動',
    subtitle: '（每週固定的例行商務會議）',
    barColor: 'bg-red-600',
  },
  {
    type: ActivityType.BUSINESS_TRAINING,
    title: '商務培訓',
    subtitle: '（提升商務能力的專業課程）',
    barColor: 'bg-orange-500',
  },
  {
    type: ActivityType.COFFEE_MEETING,
    title: '咖啡會議',
    subtitle: '（輕鬆交流的會員聚會）',
    barColor: 'bg-amber-700',
  },
  {
    type: ActivityType.REGULAR,
    title: '會員專屬活動',
    subtitle: '（會員專屬的活動例如培訓課程等）',
    barColor: 'bg-red-600',
  },
  {
    type: ActivityType.SPECIAL,
    title: '一般活動',
    subtitle: '（公開型的活動，可以邀請來賓一同參與）',
    barColor: 'bg-gray-800',
  },
];

const Home: React.FC<HomeProps> = ({ activities }) => {
  const now = new Date();

  const filterUpcoming = (a: Activity) => {
    const activityFullDate = new Date(`${a.date.replace(/-/g, '/')} ${a.time}`);
    const isActive = a.status === 'active' || !a.status;
    return isActive && activityFullDate > now;
  };

  const upcomingActivities = activities
    .filter(filterUpcoming)
    .sort((a, b) => {
      const dateA = new Date(`${a.date.replace(/-/g, '/')} ${a.time}`).getTime();
      const dateB = new Date(`${b.date.replace(/-/g, '/')} ${b.time}`).getTime();
      return dateA - dateB;
    });

  // 用於輪播的活動 (取最近的 5 個)
  const carouselActivities = upcomingActivities.slice(0, 5);

  // 各區塊的活動（依 TYPE_SECTIONS 順序）
  const sectionsWithData = TYPE_SECTIONS
    .map(section => ({
      ...section,
      items: upcomingActivities.filter(a => a.type === section.type),
    }))
    .filter(section => section.items.length > 0);

  return (
    <div className="pb-20">
      {/* Hero Carousel */}
      <HeroCarousel activities={carouselActivities} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-16">
          {sectionsWithData.map(section => (
            <div key={section.type}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex flex-col">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className={`w-2 h-8 ${section.barColor} rounded-full`}></span>
                    {section.title}
                  </h2>
                  <p className="text-gray-500 text-sm mt-1 ml-4">{section.subtitle}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {section.items.map(activity => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            </div>
          ))}

          {sectionsWithData.length === 0 && (
            <div className="bg-white p-20 rounded-3xl border border-dashed text-center">
              <Calendar className="mx-auto text-gray-200 mb-4" size={48} />
              <h3 className="text-xl font-bold text-gray-400">目前暫無即將舉行的活動</h3>
              <p className="text-gray-300 mt-2">請稍後再回來查看，或聯繫分會秘書處。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
