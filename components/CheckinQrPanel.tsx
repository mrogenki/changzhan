import React, { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { createClient } from '@supabase/supabase-js';
import { RefreshCw } from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

const LIFF_URL = import.meta.env.VITE_LIFF_URL as string | undefined;

interface Props {
  activityId: number;
  activityTitle: string;
  onAttendanceRefresh?: () => void | Promise<void>;
}

// 從 ISO timestamp 取出 'YYYY-MM-DD' 跟 'HH:MM' (使用瀏覽器當地時區)
function isoToLocalDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

// 把當地時間 'YYYY-MM-DD' + 'HH:MM' 組成 ISO timestamp (含時區)
function localDateTimeToIso(date: string, time: string): string {
  // new Date('2026-04-28T08:00') 會被解讀為當地時區
  const local = new Date(`${date}T${time}`);
  return local.toISOString();
}

// 顯示「剩餘 / 已過期」
function formatRemaining(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) {
    const past = -diff;
    const h = Math.floor(past / 3_600_000);
    const m = Math.floor((past % 3_600_000) / 60_000);
    if (h > 0) return `已過期 ${h} 小時 ${m} 分鐘`;
    return `已過期 ${m} 分鐘`;
  }
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `剩餘 ${h} 小時 ${m} 分鐘`;
  return `剩餘 ${m} 分鐘`;
}

export default function CheckinQrPanel({ activityId, activityTitle, onAttendanceRefresh }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [activityDate, setActivityDate] = useState<string>(''); // YYYY-MM-DD

  // 表單 state
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [expiryTime, setExpiryTime] = useState<string>('08:00');

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 載入活動資料 + 既有 token
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInitialLoading(true);
      const { data, error } = await supabase
        .from('activities')
        .select('date, checkin_token, checkin_token_expires_at')
        .eq('id', activityId)
        .single();

      if (cancelled) return;

      if (!error && data) {
        // 預設值:活動日期 + 08:00
        const actDate = data.date || '';
        setActivityDate(actDate);
        setExpiryDate(actDate);
        setExpiryTime('08:00');

        // 已有 token (不論是否過期都顯示,讓 admin 可以延期)
        if (data.checkin_token && data.checkin_token_expires_at) {
          setToken(data.checkin_token);
          setExpiresAt(data.checkin_token_expires_at);
          // 把既有到期時間填回 form,方便 admin 延期
          const { date, time } = isoToLocalDateTime(data.checkin_token_expires_at);
          setExpiryDate(date);
          setExpiryTime(time);
        } else {
          setToken(null);
          setExpiresAt(null);
        }
      }
      setInitialLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activityId]);

  // 產生 / 重建 token
  async function openCheckin() {
    if (!expiryDate || !expiryTime) {
      alert('請設定到期日期與時間');
      return;
    }
    const newExpiry = localDateTimeToIso(expiryDate, expiryTime);
    if (new Date(newExpiry) <= new Date()) {
      if (!confirm('設定的到期時間已是過去,確定要建立?')) return;
    }

    setLoading(true);
    try {
      const newToken = crypto.randomUUID().replace(/-/g, '');
      const { error } = await supabase
        .from('activities')
        .update({
          checkin_token: newToken,
          checkin_token_expires_at: newExpiry,
        })
        .eq('id', activityId);

      if (error) {
        alert('開啟報到失敗:' + error.message);
        return;
      }
      setToken(newToken);
      setExpiresAt(newExpiry);
    } finally {
      setLoading(false);
    }
  }

  // 只更新到期時間 (不換 token,QR 仍有效)
  async function updateExpiry() {
    if (!expiryDate || !expiryTime) {
      alert('請設定到期日期與時間');
      return;
    }
    const newExpiry = localDateTimeToIso(expiryDate, expiryTime);

    setLoading(true);
    try {
      const { error } = await supabase
        .from('activities')
        .update({ checkin_token_expires_at: newExpiry })
        .eq('id', activityId);

      if (error) {
        alert('更新到期時間失敗:' + error.message);
        return;
      }
      setExpiresAt(newExpiry);
      alert('已更新到期時間,QR code 不變');
    } finally {
      setLoading(false);
    }
  }

  async function closeCheckin() {
    if (!confirm('確定要關閉報到?會員將無法再掃 QR code 報到')) return;
    const { error } = await supabase
      .from('activities')
      .update({ checkin_token: null, checkin_token_expires_at: null })
      .eq('id', activityId);
    if (error) {
      alert('關閉失敗:' + error.message);
      return;
    }
    setToken(null);
    setExpiresAt(null);
    // reset 表單回預設
    setExpiryDate(activityDate);
    setExpiryTime('08:00');
  }

  async function handleRefresh() {
    if (!onAttendanceRefresh) return;
    setRefreshing(true);
    try {
      await onAttendanceRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  const checkinUrl = token
    ? (LIFF_URL
        ? `${LIFF_URL}?activity_id=${activityId}&token=${token}`
        : `${window.location.origin}/liff/checkin?activity_id=${activityId}&token=${token}`)
    : null;

  const isExpired = expiresAt && new Date(expiresAt) < new Date();

  if (initialLoading) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <p className="text-sm text-gray-400">載入 QR code 狀態...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">LINE 報到 QR code</h3>
        {onAttendanceRefresh && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
            title="重新載入會員報到狀態"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? '更新中...' : '重整出席'}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-600 mb-4">{activityTitle}</p>

      {/* 到期時間設定區塊 (永遠顯示) */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
        <div className="text-sm font-medium text-gray-700">到期時間</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 w-12 sm:w-auto">日期</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="border rounded px-3 py-2 text-sm flex-grow sm:flex-grow-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 w-12 sm:w-auto">時間</label>
            <input
              type="time"
              value={expiryTime}
              onChange={(e) => setExpiryTime(e.target.value)}
              className="border rounded px-3 py-2 text-sm flex-grow sm:flex-grow-0"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400">
          預設活動當天 08:00 到期,可延後讓夥伴在例會結束後補報到
        </p>
      </div>

      {!token ? (
        <button
          onClick={openCheckin}
          disabled={loading}
          className="w-full bg-blue-500 text-white px-4 py-2.5 rounded-lg disabled:opacity-50 font-medium"
        >
          {loading ? '產生中...' : '開啟報到 / 產生 QR code'}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center bg-white p-4 border rounded-lg">
            <QRCodeCanvas value={checkinUrl!} size={256} level="M" />
          </div>
          <div className="text-sm space-y-1">
            <p className="text-gray-600">
              到期時間:{new Date(expiresAt!).toLocaleString('zh-TW')}
              {isExpired && <span className="ml-2 text-red-600 font-bold">⚠️ 已過期</span>}
            </p>
            <p className={isExpired ? 'text-red-600 text-xs' : 'text-green-600 text-xs'}>
              {formatRemaining(expiresAt!)}
            </p>
            <p className="break-all text-xs text-gray-400">{checkinUrl}</p>
            {!LIFF_URL && (
              <p className="text-xs text-amber-600">
                ⚠️ 未設定 VITE_LIFF_URL 環境變數
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={updateExpiry}
              disabled={loading}
              className="bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm hover:bg-green-100 disabled:opacity-50"
              title="只更新到期時間,QR code 不變"
            >
              {loading ? '更新中...' : '更新到期時間'}
            </button>
            <button
              onClick={openCheckin}
              disabled={loading}
              className="bg-gray-100 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50"
              title="會產生新的 QR code,舊 QR 失效"
            >
              重新產生 QR
            </button>
            <button
              onClick={closeCheckin}
              className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-100"
            >
              關閉報到
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
