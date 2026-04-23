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

export default function CheckinQrPanel({ activityId, activityTitle, onAttendanceRefresh }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [durationHours, setDurationHours] = useState(3);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInitialLoading(true);
      const { data, error } = await supabase
        .from('activities')
        .select('checkin_token, checkin_token_expires_at')
        .eq('id', activityId)
        .single();

      if (cancelled) return;

      if (!error && data) {
        const notExpired = data.checkin_token_expires_at
          && new Date(data.checkin_token_expires_at) > new Date();
        if (data.checkin_token && notExpired) {
          setToken(data.checkin_token);
          setExpiresAt(data.checkin_token_expires_at);
        } else {
          setToken(null);
          setExpiresAt(null);
        }
      }
      setInitialLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activityId]);

  async function openCheckin() {
    setLoading(true);
    try {
      const newToken = crypto.randomUUID().replace(/-/g, '');
      const newExpiry = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();

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

  // 優先用 LIFF URL (格式: https://liff.line.me/xxx?a=b)
  // 否則 fallback 用網站 URL (格式: https://host/liff/checkin?a=b)
  const checkinUrl = token
    ? (LIFF_URL
        ? `${LIFF_URL}?activity_id=${activityId}&token=${token}`
        : `${window.location.origin}/liff/checkin?activity_id=${activityId}&token=${token}`)
    : null;

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

      {!token ? (
        <d
