import React, { useState } from 'react';
import { Users, CalendarDays, GraduationCap, Sparkles, Star, type LucideIcon } from 'lucide-react';
import { Activity, ActivityType } from '../types';
import { CHAPTER_NAME } from '../chapterConfig';

// 活動封面：有照片就顯示照片；沒有照片、或網址已失效時，顯示依類型配色的預設封面。
//
// 為什麼需要：小組長從 LINE 發起的組聚沒有上傳封面的步驟，原本卡片會硬塞一個
// <img src="">，結果是破圖圖示加上 alt 文字疊在左上角。
//
// 配色與行事曆（Calendar.tsx 的 TYPE_STYLE）同一套，讓同類活動在各處顏色一致。

const COVER_STYLE: Record<string, { bg: string; fg: string; Icon: LucideIcon }> = {
  [ActivityType.REGULAR_MEETING]: { bg: 'from-red-500 to-red-700', fg: 'text-red-50', Icon: CalendarDays },
  [ActivityType.BUSINESS_TRAINING]: { bg: 'from-blue-500 to-blue-700', fg: 'text-blue-50', Icon: GraduationCap },
  [ActivityType.GROUP_MEETING]: { bg: 'from-amber-400 to-amber-600', fg: 'text-amber-50', Icon: Users },
  [ActivityType.REGULAR]: { bg: 'from-purple-500 to-purple-700', fg: 'text-purple-50', Icon: Star },
  [ActivityType.SPECIAL]: { bg: 'from-emerald-500 to-emerald-700', fg: 'text-emerald-50', Icon: Sparkles },
};
const FALLBACK: { bg: string; fg: string; Icon: LucideIcon } = { bg: 'from-gray-500 to-gray-700', fg: 'text-gray-50', Icon: CalendarDays };

type Props = {
  activity: Pick<Activity, 'picture' | 'title' | 'type'> & { host_group?: string | null };
  /** 套在 <img> 或預設封面上的 class（例如 hover 放大效果） */
  className?: string;
  /** 預設封面上要不要印組別／類型文字。首頁輪播上面已經疊了標題，就關掉避免重複 */
  showCaption?: boolean;
};

const hostLabel = (g?: string | null) => (!g ? null : /^\d+$/.test(g) ? `第 ${g} 組` : g);

const ActivityCover: React.FC<Props> = ({ activity, className = '', showCaption = true }) => {
  const [broken, setBroken] = useState(false);
  const src = (activity.picture || '').trim();

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={activity.title}
        className={`w-full h-full object-cover ${className}`}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }

  const s = COVER_STYLE[activity.type] ?? FALLBACK;
  const { Icon } = s;
  // 小組長發起的組聚會帶組別，比「組聚」兩個字更有辨識度
  const caption = hostLabel(activity.host_group) ?? activity.type;

  return (
    <div
      role="img"
      aria-label={activity.title}
      className={`w-full h-full bg-gradient-to-br ${s.bg} ${s.fg} relative overflow-hidden flex flex-col items-center justify-center gap-2 ${className}`}
    >
      {/* 背景大圖示，只做紋理 */}
      <Icon size={220} className="absolute -right-10 -bottom-10 opacity-10" />
      {showCaption && (
        <>
          <Icon size={40} className="opacity-90" />
          <span className="text-lg font-bold tracking-wider opacity-95">{caption}</span>
          <span className="text-xs font-medium opacity-70">{CHAPTER_NAME}</span>
        </>
      )}
    </div>
  );
};

export default ActivityCover;
