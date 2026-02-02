import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, DollarSign, ChevronRight } from 'lucide-react';
import { Activity, ActivityType } from '../types';

interface HomeProps {
  activities: Activity[];
}

const ActivityCard: React.FC<{ activity: Activity }> = ({ activity }) => (
  <Link to={`/activity/${activity.id}`} className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
    <div className="relative h-48 overflow-hidden">
      <img src={activity.image} alt={activity.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-red-600" />
          <span className="line-clamp-1">{activity.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-red-600" />
          <span>NT$ {activity.cost.toLocaleString()}</span>
        </div>
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
        <span className="text-red-600 font-bold text-sm">立即報名</span>
        <ChevronRight size={18} className="text-red-600" />
      </div>
    </div>
  </Link>
);

const Home: React.FC<HomeProps> = ({ activities }) => {
  const now = new Date();

  // 過濾邏輯：必須是 active 狀態且日期大於現在
  const filterUpcoming = (a: Activity) => {
    const activityDate = new Date(a.date.replace(/-/g, '/')); // 確保跨瀏覽器日期解析
    return a.status === 'active' && activityDate > now;
  };

  const regularMeetings = activities.filter(a => a.type === ActivityType.REGULAR && filterUpcoming(a));
  const specialEvents = activities.filter(a => a.type === ActivityType.SPECIAL && filterUpcoming(a));

  return (
    <div className="pb-20">
      {/* Hero Section */}
      <section className="bg-red-600 text-white py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6">連結、成長、共好</h1>
          <p className="text-xl text-red-100 max-w-2xl">長展分會提供最專業的商務媒合與人脈交流活動，讓您的事業在這裡展翅高飛。</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10">
        <div className="space-y-16">
          {/* Regular Meetings */}
          {regularMeetings.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span className="w-2 h-8 bg-red-600 rounded-full"></span>
                  即將舉行的例會
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {regularMeetings.map(activity => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            </div>
          )}

          {/* Special Events */}
          {specialEvents.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span className="w-2 h-8 bg-gray-800 rounded-full"></span>
                  近期精選活動
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {specialEvents.map(activity => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            </div>
          )}

          {regularMeetings.length === 0 && specialEvents.length === 0 && (
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