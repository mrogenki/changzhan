import React from 'react';
import { useLocation } from 'react-router-dom';

const getEnv = (key: string): string | undefined => {
  try {
    return (import.meta as any)?.env?.[key];
  } catch (e) {
    return undefined;
  }
};

const LINE_OA_ID = getEnv('VITE_LINE_OA_ID') || '@568cognw';

// 把 LINE OA ID 轉成可以開啟聊天的 URL
// 接受 @xxxxx 或 xxxxx 兩種格式，自動補 @ 前綴
export const buildLineChatUrl = (oaId: string): string => {
  if (!oaId) return '';
  const trimmed = oaId.trim();
  const id = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  return `https://line.me/R/ti/p/${id}`;
};

// LINE 官方 Logo（白色填色，用在綠色底上）
export const LineLogo: React.FC<{ size?: number; className?: string }> = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
  </svg>
);

const LineFloatingButton: React.FC = () => {
  const location = useLocation();

  // 後台不顯示
  if (location.pathname.startsWith('/admin')) return null;
  // LIFF 頁面也不顯示（雖然 LIFF 是早期 return 不會走到這裡，保險起見）
  if (location.pathname.startsWith('/liff')) return null;
  // 沒設定 LINE OA ID 就不渲染
  if (!LINE_OA_ID) return null;

  const url = buildLineChatUrl(LINE_OA_ID);

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" aria-label="聯繫官方 LINE 客服" title="聯繫官方 LINE 客服" className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#06C755] hover:bg-[#05B14C] text-white pl-4 pr-5 py-3 rounded-full shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 hover:scale-105 active:scale-95 transition-all duration-200">
      <LineLogo size={22} />
      <span className="font-bold text-sm whitespace-nowrap hidden sm:inline">
        客服 LINE
      </span>
    </a>
  );
};

export default LineFloatingButton;
