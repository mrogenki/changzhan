import React, { useEffect, useState } from 'react';
import liff from '@line/liff';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

const LIFF_ID = import.meta.env.VITE_LIFF_ID as string;

type Member = { id: number; name: string };

type Phase =
  | { kind: 'loading'; msg: string }
  | { kind: 'needs_binding'; lineUserId: string; displayName: string }
  | { kind: 'success'; memberName: string; activityTitle: string }
  | { kind: 'error'; msg: string };

// 從 URL 解析 activity_id 和 token,處理 LIFF 幾種格式:
// 1. 正常格式: /liff/checkin?activity_id=10&token=xxx
// 2. 外部瀏覽器格式: /liff/checkin?liff.state=?activity_id=10&token=xxx (會被 URL encode)
function parseCheckinParams(): { activityId: string | null; token: string | null } {
  const urlParams = new URLSearchParams(window.location.search);

  // 先試直接讀取
  let activityId = urlParams.get('activity_id');
  let token = urlParams.get('token');
  if (activityId && token) return { activityId, token };

  // 再試 liff.state (LINE 外部瀏覽器會把原本 query 塞進這裡)
  const liffState = urlParams.get('liff.state');
  if (liffState) {
    // liff.state 可能是 ?activity_id=10&token=xxx 或 activity_id=10&token=xxx
    const cleaned = liffState.startsWith('?') ? liffState.substring(1) : liffState;
    const stateParams = new URLSearchParams(cleaned);
    activityId = stateParams.get('activity_id');
    token = stateParams.get('token');
    if (activityId && token) return { activityId, token };
  }

  return { activityId: null, token: null };
}

export default function LiffCheckin() {
  // 取得 activity_id / token:
  // 優先從 URL (含 liff.state fallback) 讀;若無則從 sessionStorage 還原
  const parsed = parseCheckinParams();
  let activityIdRaw: string | null = parsed.activityId;
  let tokenFromUrl: string | null = parsed.token;

  if (activityIdRaw && tokenFromUrl) {
    sessionStorage.setItem('liff_checkin_activity_id', activityIdRaw);
    sessionStorage.setItem('liff_checkin_token', tokenFromUrl);
  } else {
    activityIdRaw = sessionStorage.getItem('liff_checkin_activity_id');
    tokenFromUrl = sessionStorage.getItem('liff_checkin_token');
  }

  const activityId = activityIdRaw ? Number(activityIdRaw) : null;
  const token = tokenFromUrl;

  const [phase, setPhase] = useState<Phase>({ kind: 'loading', msg: '初始化 LINE...' });

  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | ''>('');
  const [phone4, setPhone4] = useState('');
  const [binding, setBinding] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!activityId || !token) {
          setPhase({ kind: 'error', msg: '連結不完整,請重新掃描 QR code' });
          return;
        }
        if (!LIFF_ID) {
          setPhase({ kind: 'error', msg: 'LIFF ID 未設定,請聯絡管理員' });
          return;
        }

        await liff.init({ liffId: LIFF_ID });

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        setPhase({ kind: 'loading', msg: '取得 LINE 資料...' });
        const profile = await liff.getProfile();

        setPhase({ kind: 'loading', msg: '報到中...' });
        const { data, error } = await supabase.rpc('line_checkin', {
          p_activity_id: activityId,
          p_token: token,
          p_line_user_id: profile.userId,
        });

        if (error) {
          setPhase({ kind: 'error', msg: '系統錯誤:' + error.message });
          return;
        }

        if (data?.success) {
          sessionStorage.removeItem('liff_checkin_activity_id');
          sessionStorage.removeItem('liff_checkin_token');
          setPhase({
            kind: 'success',
            memberName: data.member_name,
            activityTitle: data.activity_title,
          });
          return;
        }

        if (data?.error === 'NOT_BOUND') {
          const { data: memberList } = await supabase
            .from('members')
            .select('id, name')
            .is('line_user_id', null)
            .order('name');

          setMembers(memberList ?? []);
          setPhase({
            kind: 'needs_binding',
            lineUserId: profile.userId,
            displayName: profile.displayName,
          });
          return;
        }

        setPhase({ kind: 'error', msg: data?.error ?? '未知錯誤' });
      } catch (e: any) {
        setPhase({ kind: 'error', msg: '發生錯誤:' + (e?.message ?? String(e)) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBind() {
    if (phase.kind !== 'needs_binding') return;
    if (!selectedMemberId) {
      alert('請選擇你的名字');
      return;
    }
    if (!/^\d{4}$/.test(phone4)) {
      alert('請輸入 4 位數字');
      return;
    }

    setBinding(true);
    try {
      const { data, error } = await supabase.rpc('bind_line_user', {
        p_member_id: selectedMemberId,
        p_line_user_id: phase.lineUserId,
        p_phone_last4: phone4,
      });

      if (error) {
        alert('系統錯誤:' + error.message);
        return;
      }
      if (!data?.success) {
        alert(data?.error ?? '綁定失敗');
        return;
      }

      setPhase({ kind: 'loading', msg: '綁定成功,正在報到...' });
      const checkin = await supabase.rpc('line_checkin', {
        p_activity_id: activityId,
        p_token: token,
        p_line_user_id: phase.lineUserId,
      });
      if (checkin.data?.success) {
        sessionStorage.removeItem('liff_checkin_activity_id');
        sessionStorage.removeItem('liff_checkin_token');
        setPhase({
          kind: 'success',
          memberName: checkin.data.member_name,
          activityTitle: checkin.data.activity_title,
        });
      } else {
        setPhase({ kind: 'error', msg: checkin.data?.error ?? '報到失敗' });
      }
    } finally {
      setBinding(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-center mb-2">BNI 長展分會</h1>
        <p className="text-center text-gray-500 mb-6">例會報到</p>

        {phase.kind === 'loading' && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4" />
            <p className="text-gray-600">{phase.msg}</p>
          </div>
        )}

        {phase.kind === 'success' && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-xl font-bold text-green-600 mb-2">報到成功</p>
            <p className="text-gray-700">{phase.memberName}</p>
            <p className="text-sm text-gray-500 mt-4">{phase.activityTitle}</p>
            <p className="text-xs text-gray-400 mt-6">請點右上角 ✕ 關閉此頁</p>
          </div>
        )}

        {phase.kind === 'error' && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">⚠️</div>
            <p className="text-red-600 font-medium">{phase.msg}</p>
            <button
              onClick={() => {
                sessionStorage.removeItem('liff_checkin_activity_id');
                sessionStorage.removeItem('liff_checkin_token');
                window.location.reload();
              }}
              className="mt-6 w-full bg-blue-500 text-white py-3 rounded-lg"
            >
              重試
            </button>
          </div>
        )}

        {phase.kind === 'needs_binding' && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Hi {phase.displayName},首次使用請先綁定會員資料(只需一次)
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">選擇你的名字</label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">-- 請選擇 --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">手機末 4 碼(驗證用)</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={4}
                  value={phone4}
                  onChange={(e) => setPhone4(e.target.value.replace(/\D/g, ''))}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="例如 1234"
                />
              </div>
              <button
                onClick={handleBind}
                disabled={binding}
                className="w-full bg-blue-500 text-white py-3 rounded-lg disabled:opacity-50"
              >
                {binding ? '綁定中...' : '綁定並報到'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
