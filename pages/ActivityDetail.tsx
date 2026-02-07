import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, DollarSign, ArrowLeft, CheckCircle2, Share2, CopyCheck, Clock, Loader2 } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { Activity, Registration } from '../types';

// TODO: 請替換為您 EmailJS 後台的實際資訊
// 1. 前往 https://www.emailjs.com/ 註冊
// 2. Add Service (例如 Gmail) -> 獲得 Service ID
// 3. Email Templates -> Create New Template -> 獲得 Template ID
//    Template 變數建議設定為: {{user_name}}, {{activity_title}}, {{activity_date}}, {{activity_time}}, {{activity_location}}
// 4. Account -> Public Key
const EMAILJS_SERVICE_ID: string = 'service_3cvfu3x';
const EMAILJS_TEMPLATE_ID: string = 'template_tsptg0x';
const EMAILJS_PUBLIC_KEY: string = 'ajJknYqtnk3p1_WmI';

interface ActivityDetailProps {
  activities: Activity[];
  registrations: Registration[];
  onRegister: (reg: Registration) => Promise<boolean>; // 更新型別
}

const ActivityDetail: React.FC<ActivityDetailProps> = ({ activities, registrations, onRegister }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const activity = activities.find(a => String(a.id) === id);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
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

  if (!activity) {
    return <div className="p-20 text-center">活動不存在</div>;
  }

  const alreadyRegisteredCount = registrations.filter(r => String(r.activityId) === String(id)).length;

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareText = `【長展分會活動推薦】\n活動：${activity.title}\n日期：${activity.date}\n時間：${activity.time}\n地點：${activity.location}\n\n立即點擊連結報名：\n${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: activity.title,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.log('Share failed', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        setShowCopyTooltip(true);
        setTimeout(() => setShowCopyTooltip(false), 2000);
      } catch (err) {
        alert('無法自動複製，請手動分享連結');
      }
    }
  };

  const sendConfirmationEmail = async (reg: Registration) => {
    // 檢查是否已設定 EmailJS 金鑰，若為預設值則跳過發送 (避免報錯)
    if (EMAILJS_SERVICE_ID === 'YOUR_SERVICE_ID') {
      console.warn('EmailJS 尚未設定，跳過郵件發送');
      return;
    }

    setIsSendingEmail(true);
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_name: reg.name,
          to_email: reg.email,
          activity_title: activity.title,
          activity_date: activity.date,
          activity_time: activity.time,
          activity_location: activity.location,
          activity_price: activity.price,
          company: reg.company,
          title: reg.title,
          message: `感謝您報名 ${activity.title}，我們期待您的蒞臨！`
        },
        EMAILJS_PUBLIC_KEY
      );
      console.log('報名確認信發送成功');
    } catch (error) {
      console.error('報名確認信發送失敗:', error);
      // 這裡不跳出 alert，因為報名已經成功，Email 失敗不應該阻擋成功頁面
    } finally {
      setIsSendingEmail(false);
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
      // referrer 是選填
      ...(formData.referrer ? { referrer: formData.referrer } : {}),
      created_at: new Date().toISOString()
    };

    // 使用 await 等待 App.tsx 的 handleRegister 回傳結果
    try {
      const success = await onRegister(newRegistration);
      if (success) {
        // 報名成功後，嘗試發送 Email
        await sendConfirmationEmail(newRegistration);
        
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
          <div className="rounded-2xl overflow-hidden shadow-sm">
            <img src={activity.picture} alt={activity.title} className="w-full h-[400px] object-cover" />
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
                  <p className="font-medium">NT$ {activity.price.toLocaleString()}</p>
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
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">引薦人 (選填)</label>
                <input 
                  type="text" 
                  value={formData.referrer}
                  onChange={e => setFormData({...formData, referrer: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none"
                  placeholder="引薦您的分會成員姓名"
                />
              </div>
              
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                   <>
                     <Loader2 className="animate-spin" size={20} />
                     {isSendingEmail ? '正在發送通知...' : '處理中...'}
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