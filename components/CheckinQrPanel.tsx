import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

interface Props {
  activityId: number;
  activityTitle: string;
}

export default function CheckinQrPanel({ activityId, activityTitle }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [durationHours, setDurationHours] = useState(3);

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

  const checkinUrl = token
    ? `${window.location.origin}/liff/checkin?activity_id=${activityId}&token=${token}`
    : null;

  return (
    <div className="bg-white border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">LINE 報到 QR code</h3>
      <p className="text-sm text-gray-600 mb-4">{activityTitle}</p>

      {!token ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm">有效時數</label>
            <input
              type="number"
              min={1}
              max={24}
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className="w-20 border rounded px-2 py-1"
            />
            <span className="text-sm text-gray-500">小時</span>
          </div>
          <button
            onClick={openCheckin}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {loading ? '產生中...' : '開啟報到 / 產生 QR code'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center bg-white p-4 border rounded-lg">
            <QRCodeCanvas value={checkinUrl!} size={256} level="M" />
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <p>過期時間:{new Date(expiresAt!).toLocaleString('zh-TW')}</p>
            <p className="break-all text-xs text-gray-400">{checkinUrl}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openCheckin}
              className="flex-1 bg-gray-100 px-4 py-2 rounded-lg text-sm"
            >
              重新產生 token
            </button>
            <button
              onClick={closeCheckin}
              className="flex-1 bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm"
            >
              關閉報到
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
