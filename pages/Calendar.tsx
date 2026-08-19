import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MapPin, Clock, CalendarDays } from 'lucide-react';
import { Activity, ActivityType } from '../types';

interface Props {
  activities: Activity[];
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

// 各活動類型的顏色，行事曆格子與圖例共用
const TYPE_STYLE: Record<string, { chip: string; dot: string; label: string }> = {
  [ActivityType.REGULAR_MEETING]: { chip: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: '例會活動' },
  [ActivityType.BUSINESS_TRAINING]: { chip: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', label: '商務培訓' },
  [ActivityType.GROUP_MEETING]: { chip: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: '組聚' },
  [ActivityType.REGULAR]: { chip: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', label: '會員專屬' },
  [ActivityType.SPECIAL]: { chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: '一般活動' },
};
const FALLBACK_STYLE = { chip: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', label: '其他' };
const styleOf = (type: string) => TYPE_STYLE[type] ?? FALLBACK_STYLE;

// 一律以台北時間為準：activities.date 是純日期字串，用 new Date(str) 會被當成 UTC 而差一天
const todayKey = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts; // en-CA 就是 YYYY-MM-DD
};

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

const Calendar: React.FC<Props> = ({ activities }) => {
  const today = todayKey();
  const [todayY, todayM] = today.split('-').map(Number);

  const [year, setYear] = useState(todayY);
  const [month, setMonth] = useState(todayM); // 1–12
  const [selected, setSelected] = useState<string>(today);

  // 只顯示上架中的活動，與其他公開頁一致
  const activitiesByDate = useMemo(() => {
    const map = new Map<string, Activity[]>();
    activities
      .filter(a => a.status === 'active' || !a.status)
      .forEach(a => {
        if (!a.date) return;
        const list = map.get(a.date) ?? [];
        list.push(a);
        map.set(a.date, list);
      });
    map.forEach(list => list.sort((x, y) => (x.time || '').localeCompare(y.time || '')));
    return map;
  }, [activities]);

  // 月曆格子：補滿前後空白，湊成完整的週
  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const out: Array<{ day: number; key: string } | null> = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push({ day: d, key: keyOf(year, month, d) });
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  const goMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    setYear(y);
    setMonth(m);
    // 換月後選取跟著移動，否則下方詳情會停在別的月份，看起來像沒反應
    setSelected(y === todayY && m === todayM ? today : keyOf(y, m, 1));
  };

  const goToday = () => {
    setYear(todayY);
    setMonth(todayM);
    setSelected(today);
  };

  const selectedActivities = activitiesByDate.get(selected) ?? [];

  // 這個月有出現的活動類型，圖例只列出用得到的
  const legendTypes = useMemo(() => {
    const set = new Set<string>();
    cells.forEach(c => {
      if (!c) return;
      (activitiesByDate.get(c.key) ?? []).forEach(a => set.add(a.type));
    });
    return Array.from(set);
  }, [cells, activitiesByDate]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center justify-center gap-2">
          <CalendarDays className="text-red-600" size={30} /> 活動行事曆
        </h1>
        <p className="text-gray-400 mt-2 font-medium">長展分會的例會、培訓與精選活動，一次看清楚</p>
      </div>

      {/* 月份切換 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => goMonth(-1)}
          aria-label="上個月"
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">
            {year} 年 {month} 月
          </h2>
          <button
            onClick={goToday}
            className="text-xs font-bold text-red-600 border border-red-200 px-3 py-1 rounded-full hover:bg-red-50 transition-colors"
          >
            今天
          </button>
        </div>
        <button
          onClick={() => goMonth(1)}
          aria-label="下個月"
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* 月曆 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`py-2 text-center text-xs font-bold ${i === 0 || i === 6 ? 'text-red-400' : 'text-gray-400'}`}
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} className="min-h-[76px] sm:min-h-[104px] bg-gray-50/40 border-b border-r border-gray-50" />;

            const acts = activitiesByDate.get(cell.key) ?? [];
            const isToday = cell.key === today;
            const isSelected = cell.key === selected;

            return (
              <button
                key={cell.key}
                onClick={() => setSelected(cell.key)}
                className={`min-h-[76px] sm:min-h-[104px] p-1.5 sm:p-2 text-left border-b border-r border-gray-50 align-top transition-colors ${
                  isSelected ? 'bg-red-50/70 ring-2 ring-inset ring-red-400' : 'hover:bg-gray-50'
                }`}
              >
                <div className="mb-1">
                  <span
                    className={`text-xs sm:text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-red-600 text-white' : 'text-gray-700'
                    }`}
                  >
                    {cell.day}
                  </span>
                </div>

                {/* 手機版空間不夠，只點出顏色圓點；桌機才顯示活動名稱 */}
                <div className="hidden sm:block space-y-1">
                  {acts.slice(0, 2).map(a => (
                    <div
                      key={a.id}
                      className={`text-[10px] leading-tight font-bold px-1.5 py-1 rounded truncate ${styleOf(a.type).chip}`}
                    >
                      {a.title}
                    </div>
                  ))}
                  {acts.length > 2 && (
                    <div className="text-[10px] text-gray-400 font-bold pl-1">＋{acts.length - 2}</div>
                  )}
                </div>
                <div className="sm:hidden flex flex-wrap gap-1">
                  {acts.slice(0, 4).map(a => (
                    <span key={a.id} className={`w-1.5 h-1.5 rounded-full ${styleOf(a.type).dot}`} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 圖例 */}
      {legendTypes.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 justify-center">
          {legendTypes.map(t => (
            <span key={t} className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <span className={`w-2.5 h-2.5 rounded-full ${styleOf(t).dot}`} /> {styleOf(t).label}
            </span>
          ))}
        </div>
      )}

      {/* 選取日期的詳情 */}
      <div className="mt-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          {Number(selected.split('-')[0])} 年 {Number(selected.split('-')[1])} 月 {Number(selected.split('-')[2])} 日
          {selected === today && <span className="ml-2 text-xs bg-red-600 text-white px-2 py-0.5 rounded-full align-middle">今天</span>}
        </h3>

        {selectedActivities.length === 0 ? (
          <p className="text-gray-400 text-sm bg-white border border-gray-100 rounded-2xl p-8 text-center">
            這天沒有安排活動
          </p>
        ) : (
          <div className="space-y-3">
            {selectedActivities.map(a => (
              <Link
                key={a.id}
                to={`/activity/${a.id}`}
                className="block bg-white border border-gray-100 rounded-2xl p-4 hover:border-red-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded mb-2 ${styleOf(a.type).chip}`}>
                      {a.type}
                    </span>
                    <p className="font-bold text-gray-900 truncate">{a.title}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                      {a.time && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {a.time}
                        </span>
                      )}
                      {a.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} /> {a.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {a.price > 0 && <p className="font-bold text-red-600 whitespace-nowrap">NT$ {a.price}</p>}
                    <p className="text-[11px] text-gray-400 font-bold mt-1">查看詳情 →</p>
                  </div>
                </div>
              </Link>
            ))}

          </div>
        )}
      </div>
    </div>
  );
};

export default Calendar;
