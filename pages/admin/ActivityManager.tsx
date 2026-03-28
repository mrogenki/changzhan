
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, Clock, MapPin, Image as ImageIcon, UploadCloud, Loader2 } from 'lucide-react';
import { Activity, ActivityType } from '../../types';

interface ActivityManagerProps {
  activities: Activity[];
  onAddActivity: (act: Activity) => void;
  onUpdateActivity: (act: Activity) => void;
  onDeleteActivity: (id: string | number) => void;
  onUploadImage: (file: File) => Promise<string>;
}

const ActivityManager: React.FC<ActivityManagerProps> = ({ activities, onAddActivity, onUpdateActivity, onDeleteActivity, onUploadImage }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  
  const today = new Date().toISOString().split('T')[0];

  const upcomingActivities = activities
    .filter(a => a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  
  const pastActivities = activities
    .filter(a => a.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  const displayActivities = activeTab === 'upcoming' ? upcomingActivities : pastActivities;

  const defaultFormState = {
    title: '',
    type: ActivityType.REGULAR,
    date: '',
    time: '06:30',
    location: '台北市大安區忠孝東路四段 218 號 (阿波羅大廈)',
    price: 500,
    picture: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=2069&auto=format&fit=crop',
    description: ''
  };

  const [formData, setFormData] = useState(defaultFormState);

  useEffect(() => {
    if (editingActivity) {
      setFormData({
        title: editingActivity.title,
        type: editingActivity.type,
        date: editingActivity.date,
        time: editingActivity.time,
        location: editingActivity.location,
        price: editingActivity.price,
        picture: editingActivity.picture,
        description: editingActivity.description
      });
    } else {
      setFormData(defaultFormState);
    }
  }, [editingActivity, isModalOpen]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const url = await onUploadImage(file);
        setFormData(prev => ({ ...prev, picture: url }));
      } catch (error) {
        alert('圖片上傳失敗');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const activityData: Activity = {
      id: editingActivity ? editingActivity.id : Date.now().toString(),
      ...formData,
      status: 'active'
    };

    if (editingActivity) {
      onUpdateActivity(activityData);
    } else {
      onAddActivity(activityData);
    }
    setIsModalOpen(false);
    setEditingActivity(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">活動管理</h1>
        <button 
          onClick={() => { setEditingActivity(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-sm"
        >
          <Plus size={18} /> 新增活動
        </button>
      </div>

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
            activeTab === 'upcoming' 
              ? 'border-red-600 text-red-600' 
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          即將舉行 ({upcomingActivities.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
            activeTab === 'past' 
              ? 'border-red-600 text-red-600' 
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          過往活動 ({pastActivities.length})
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayActivities.length > 0 ? (
          displayActivities.map(activity => (
            <div key={activity.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-lg transition-all">
              <div className="relative aspect-video">
                <img src={activity.picture} alt={activity.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute top-2 right-2 flex gap-1">
                  <button 
                    onClick={() => { setEditingActivity(activity); setIsModalOpen(true); }}
                    className="p-2 bg-white/90 rounded-lg text-gray-700 hover:text-blue-600 backdrop-blur-sm"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => { if(window.confirm('確定要刪除此活動嗎？')) onDeleteActivity(activity.id); }}
                    className="p-2 bg-white/90 rounded-lg text-gray-700 hover:text-red-600 backdrop-blur-sm"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="absolute bottom-2 left-2">
                   <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      activity.type === ActivityType.REGULAR ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'
                   }`}>
                     {activity.type}
                   </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 text-xs text-gray-400 font-bold mb-2">
                  <Calendar size={12} /> {activity.date}
                  <Clock size={12} /> {activity.time}
                </div>
                <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">{activity.title}</h3>
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-4">
                  <MapPin size={12} /> <span className="line-clamp-1">{activity.location}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                   <span className="font-bold text-red-600">NT$ {activity.price}</span>
                   <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activity.date < today ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-600'}`}>
                     {activity.date < today ? '已結束' : '進行中'}
                   </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-gray-400 font-bold">目前沒有{activeTab === 'upcoming' ? '近期' : '過往'}活動</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">{editingActivity ? '編輯活動' : '新增活動'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">活動標題</label>
                  <input 
                    required 
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" 
                    placeholder="活動名稱" 
                  />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">活動類型</label>
                   <select 
                     value={formData.type}
                     onChange={e => setFormData({...formData, type: e.target.value as ActivityType})}
                     className="w-full border rounded-lg px-3 py-3 bg-white outline-none focus:ring-2 focus:ring-red-500"
                   >
                     <option value={ActivityType.REGULAR}>會員專屬</option>
                     <option value={ActivityType.SPECIAL}>一般活動</option>
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">報名費用</label>
                   <input 
                    required 
                    type="number"
                    value={formData.price} 
                    onChange={e => setFormData({...formData, price: parseInt(e.target.value)})}
                    className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" 
                    placeholder="500" 
                  />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">活動日期</label>
                   <input 
                    required 
                    type="date"
                    value={formData.date} 
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" 
                  />
                </div>
                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">活動時間</label>
                   <input 
                    required 
                    type="time"
                    value={formData.time} 
                    onChange={e => setFormData({...formData, time: e.target.value})}
                    className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">活動地點</label>
                  <input 
                    required 
                    value={formData.location} 
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500" 
                    placeholder="地址" 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">活動圖片</label>
                  <div className="flex gap-4 items-start">
                    <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                      {formData.picture ? <img src={formData.picture} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <ImageIcon className="w-full h-full p-6 text-gray-300" />}
                    </div>
                    <div className="flex-grow space-y-3">
                       <div className="relative">
                         <input 
                           type="file" 
                           accept="image/*"
                           onChange={handleImageChange}
                           className="hidden"
                           id="upload-image"
                         />
                         <label 
                           htmlFor="upload-image" 
                           className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors ${isUploading ? 'bg-gray-100 text-gray-400 cursor-wait' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                         >
                           {isUploading ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
                           {isUploading ? '上傳中...' : '上傳圖片'}
                         </label>
                       </div>
                       <input 
                          value={formData.picture} 
                          onChange={e => setFormData({...formData, picture: e.target.value})}
                          className="w-full border rounded-lg px-3 py-2 text-xs text-gray-500 outline-none focus:ring-2 focus:ring-red-500" 
                          placeholder="或貼上圖片 URL" 
                        />
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">活動說明</label>
                  <textarea 
                    rows={4}
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full border rounded-lg px-3 py-3 outline-none focus:ring-2 focus:ring-red-500 resize-none" 
                    placeholder="活動詳細內容..." 
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4 border-t border-gray-100 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 border py-3 rounded-lg font-bold text-gray-500 hover:bg-gray-50 transition-colors">取消</button>
                <button type="submit" disabled={isUploading} className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold shadow-lg shadow-red-100 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50">
                   {editingActivity ? '更新活動' : '建立活動'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityManager;
