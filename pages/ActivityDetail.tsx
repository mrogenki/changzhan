import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, DollarSign, ArrowLeft, CheckCircle2, Share2, CopyCheck, Clock, Loader2, Search, User } from 'lucide-react';
import { Activity, Registration, Member } from '../types';

// 報名確認信改由 Supabase edge function `send-registration-email`（Resend）寄送，
// 由 App.tsx::handleRegister 在報名寫入成功後 fire-and-forget 呼叫。
// 前端不再碰任何寄信金鑰。

interface ActivityDetailProps {
  activities: Activity[];
  registrations: Registration[];
  members: Member[];
  onRegister: (reg: Registration) => Promise<boolean>; // 更新型別
}

const ActivityDetail: React.FC<ActivityDetailProps> = ({ activities, registrations, members, onRegister }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const activity = activities.find(a => String(a.id) === id);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showCopyTooltip, setShowCopyTooltip] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    title: '',
    referrer: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.company && m.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 下拉選項＝「BNI長展分會」官方選項 + 會員；兩者欄位不同，用共同型別描述
  type ReferrerOption = { id: string | number; name: string; company?: string; isSpecial?: boolean };
  const displayOptions: ReferrerOption[] = [
    ...(searchTerm === '' || 'BNI長展分會'.toLowerCase().includes(searchTerm.toLowerCase()) 
      ? [{ id: 'special-bni', name: 'BNI長展分會', company: '網路資訊 / 無特定引薦人', isSpecial: true }] 
      : []),
    ...filteredMembers
  ];

  if (!activity) {
    return <div className="p-20 text-center">活動不存在</div>;
  }

  const alreadyRegisteredCount = registrations.filter(r => String(r.activityId) === String(id)).length;

  const handleShare = async () => {
    // 在 share URL 加上 ?t={timestamp} cache buster，
    // 讓 LINE / FB / 其他平台每次都重新抓 OG tag，避開舊縮圖 cache 殘留
    const url = new URL(window.location.href);
    url.searchParams.set('t', String(Date.now()));
    const shareUrl = url.toString();

    const description = activity.description?.trim();
    const descriptionBlock = description ? `\n\n📋 活動介紹：\n${description}` : '';
    const shareText = `【長展分會活動推薦】\n活動：${activity.title}\n日期：${activity.date}\n時間：${activity.time}\n地點：${activity.location}${descriptionBlock}\n\n立即點擊連結報名：`;

    if (navigator.share) {
      try {
        // navigator.share 會自動處理 url，若 text 中也包含 url 會導致重複出現
        await navigator.share({
          title: activity.title,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.log('Share failed', err);
      }
    } else {
      // 不支援原生分享時，複製到剪貼簿的內容需包含連結
      const fullCopyText = `${shareText}\n${shareUrl}`;
      try {
        await navigator.clipboard.writeText(fullCopyText);
        setShowCopyTooltip(true);
        setTimeout(() => setShowCopyTooltip(false), 2000);
      } catch (err) {
        alert('無法自動複製，請手動分享連結');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // 建構寫入資料庫的物件
    // 這裡只負責建立物件，不要加入 check_in_status 等後台欄位，讓資料庫使用預設值
    const newRegistration: Registration = {
      id: Math.random().toString(36).substr(2, 9), 
      activityId: activity.id,
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      company: formData.company,
      title: formData.title,
      referrer: formData.referrer,
      created_at: new Date().toISOString()
    };

    // 使用 await 等待 App.tsx 的 handleRegister 回傳結果
    try {
      const success = await onRegister(newRegistration);
      if (success) {
        // 確認信由 App.tsx::handleRegister 觸發 edge function 寄送，不阻擋成功畫面
        setIsSuccess(true);
        // 不再重置 isSubmitting，讓畫面停留在成功狀態
      } else {
        setIsSubmitting(false); // 失敗才恢復按鈕
      }
    } catch (error) {
      console.error(error);
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle2 size={80} className="text-green-500 animate-in zoom-in duration-300" />
        </div>
        <h2 className="text-3xl font-bold mb-4">報名成功！</h2>
        <p className="text-gray-500 mb-2">感謝您的參與，我們期待在活動現場見到您。</p>
        <p className="text-sm text-gray-400 mb-8">(確認信已寄送至您的信箱)</p>
        <button 
          onClick={() => navigate('/')}
          className="bg-red-600 text-white px-8 py-3 rounded-full font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
        >
          返回活動列表
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex justify-between items-center mb-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors">
          <ArrowLeft size={20} />
          返回
        </button>
        <div className="relative">
          <button 
            onClick={handleShare}
            className="flex items-center gap-2 border border-red-600 text-red-600 px-4 py-2 rounded-full text-sm font-bold hover:bg-red-50 transition-all active:scale-95"
          >
            {showCopyTooltip ? <CopyCheck size={18} /> : <Share2 size={18} />}
            {showCopyTooltip ? '已複製資訊' : '一鍵轉發分享'}
          </button>
          {showCopyTooltip && (
            <div className="absolute top-full right-0 mt-2 bg-gray-800 text-white text-xs py-1 px-3 rounded shadow-lg animate-bounce whitespace-nowrap">
              內容已複製到剪貼簿！
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-sm">
            <img 
              src={activity.picture} 
              alt={activity.title} 
              className="absolute inset-0 w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
          </div>
          
          <div>
            <div className="flex items-center gap-3 mb-4">
               <span className="bg-red-100 text-red-600 px-3 py-1 rounded-md text-sm font-bold">{activity.type}</span>
               <span className="text-gray-400 text-sm">已有 {alreadyRegisteredCount} 人報名</span>
            </div>
            <h1 className="text-4xl font-bold mb-6">{activity.title}</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-2xl border border-gray-100 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600">
                  <Calendar size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">日期時間</p>
                  <p className="font-medium">{activity.date}</p>
                  <p className="text-sm text-gray-500 font-bold">{activity.time}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600">
                  <MapPin size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">地點</p>
                  <p className="font-medium">{activity.location}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600">
                  <DollarSign size={24} />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">費用</p>
                  {activity.member_price != null ? (
                    <>
                      <p className="font-medium">一般 NT$ {activity.price.toLocaleString()}</p>
                      <p className="font-medium text-red-600">
                        會員 NT$ {activity.member_price.toLocaleString()}
                      </p>
                    </>
                  ) : (
                    <p className="font-medium">NT$ {activity.price.toLocaleString()}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="prose prose-red max-w-none">
              <h3 className="text-xl font-bold mb-4">活動介紹</h3>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{activity.description}</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-xl sticky top-24">
            <h3 className="text-2xl font-bold mb-6 text-center">報名資料</h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">姓名</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none"
                  placeholder="請輸入真實姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">手機號碼</label>
                <input 
                  required
                  type="tel" 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none"
                  placeholder="09xx-xxx-xxx"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">電子郵件 (將寄送確認信)</label>
                <input 
                  required
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none"
                  placeholder="example@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">公司/品牌名稱</label>
                <input 
                  required
                  type="text" 
                  value={formData.company}
                  onChange={e => setFormData({...formData, company: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none"
                  placeholder="您的公司名稱"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">職務</label>
                <input 
                  required
                  type="text" 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none"
                  placeholder="您的目前職位"
                />
              </div>
              <div className="relative">
                <label className="block text-sm font-bold text-gray-700 mb-2">引薦人</label>
                <div className="relative">
                  <input 
                    required
                    type="text" 
                    value={formData.referrer}
                    onChange={e => {
                      setFormData({...formData, referrer: e.target.value});
                      setSearchTerm(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none"
                    placeholder="搜尋或選擇引薦人 (若無請選 BNI長展分會)"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search size={18} />
                  </div>
                </div>

                {isDropdownOpen && (searchTerm || isDropdownOpen) && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    {displayOptions.length > 0 ? (
                      displayOptions.map(member => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => {
                            setFormData({...formData, referrer: member.name});
                            setSearchTerm('');
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-3 text-left hover:bg-red-50 flex items-center justify-between transition-colors border-b border-gray-50 last:border-0 ${member.isSpecial ? 'bg-red-50/30' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${member.isSpecial ? 'bg-red-600 text-white' : 'bg-red-100 text-red-600'}`}>
                              <User size={14} />
                            </div>
                            <div>
                              <p className="font-bold text-gray-800">{member.name}</p>
                              <p className="text-xs text-gray-400">{member.company || '長展分會成員'}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${member.isSpecial ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            {member.isSpecial ? '官方選項' : '分會成員'}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center">
                        <p className="text-gray-400 text-sm">找不到相符的成員</p>
                        <button 
                          type="button"
                          onClick={() => setIsDropdownOpen(false)}
                          className="text-red-600 text-xs font-bold mt-2 hover:underline"
                        >
                          直接使用輸入的姓名
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {/* 點擊外部關閉下拉選單 */}
                {isDropdownOpen && (
                  <div 
                    className="fixed inset-0 z-0" 
                    onClick={() => setIsDropdownOpen(false)}
                  />
                )}
              </div>
              
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                   <>
                     <Loader2 className="animate-spin" size={20} />
                     處理中...
                   </>
                ) : '提交報名'}
              </button>
            </form>
            <p className="text-center text-xs text-gray-400 mt-6 leading-tight">
              點擊提交即代表您同意本分會的個人資料保護政策與活動規章。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityDetail;