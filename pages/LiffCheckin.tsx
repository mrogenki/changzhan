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
  // 未綁定:要求選身份
  | { kind: 'choose_identity'; lineUserId: string; displayName: string }
  // 會員綁定
  | { kind: 'member_binding'; lineUserId: string; displayName: string }
  // 訪客綁定
  | { kind: 'guest_binding'; lineUserId: string; displayName: string }
  // 成功
  | { kind: 'success'; name: string; activityTitle: string; isGuest: boolean }
  | { kind: 'error'; msg: string };

function parseCheckinParams(): { activityId: string | null; token: string | null } {
  const urlParams = new URLSearchParams(window.location.search);
  let activityId = urlParams.get('activity_id');
  let token = urlParams.get('token');
  if (activityId && token) return { activityId, token };

  const liffState = urlParams.get('liff.state');
  if (liffState) {
    const cleaned = liffState.startsWith('?') ? liffState.substring(1) : liffState;
    const stateParams = new URLSearchParams(cleaned);
    activityId = stateParams.get('activity_id');
    token = stateParams.get('token');
    if (activityId && token) return { activityId, token };
  }

  return { activityId: null, token: null };
}

export default function LiffCheckin() {
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

  // 會員綁定用 state
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | ''>('');
  const [memberPhone4, setMemberPhone4] = useState('');

  // 訪客綁定用 state
  const [guestPhone4, setGuestPhone4] = useState('');

  const [submitting, setSubmitting] = useState(false);

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

        // 已綁定使用者(會員或來賓)直接報到成功
        if (data?.success) {
          sessionStorage.removeItem('liff_checkin_activity_id');
          sessionStorage.removeItem('liff_checkin_token');
          setPhase({
            kind: 'success',
            name: data.name,
            activityTitle: data.activity_title,
            isGuest: data.kind === 'guest',
          });
          return;
        }

        // 未綁定 → 顯示身份選擇
        if (data?.error === 'NOT_BOUND') {
          setPhase({
            kind: 'choose_identity',
            lineUserId: profile.userId,
            displayName: profile.displayName,
          });
          return;
        }

        // 其他錯誤 (token 失效、已綁定但該場無報名紀錄 等)
        setPhase({ kind: 'error', msg: data?.error ?? '未知錯誤' });
      } catch (e: any) {
        setPhase({ kind: 'error', msg: '發生錯誤:' + (e?.message ?? String(e)) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 選擇會員身份
  async function chooseAsMember() {
    if (phase.kind !== 'choose_identity') return;
    setPhase({ kind: 'loading', msg: '載入會員名單...' });
    try {
      const { data: memberList } = await supabase
        .from('members')
        .select('id, name')
        .is('line_user_id', null)
        .order('name');

      setMembers(memberList ?? []);
      setPhase({
        kind: 'member_binding',
        lineUserId: phase.lineUserId,
        displayName: phase.displayName,
      });
    } catch (e: any) {
      setPhase({ kind: 'error', msg: '發生錯誤:' + (e?.message ?? String(e)) });
    }
  }

  // 選擇來賓身份
  function chooseAsGuest() {
    if (phase.kind !== 'choose_identity') return;
    setPhase({
      kind: 'guest_binding',
      lineUserId: phase.lineUserId,
      displayName: phase.displayName,
    });
  }

  // 會員綁定 + 報到
  async function handleMemberBind() {
    if (phase.kind !== 'member_binding') return;
    if (!selectedMemberId) {
      alert('請選擇你的名字');
      return;
    }
    if (!/^\d{4}$/.test(memberPhone4)) {
      alert('請輸入 4 位數字');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('bind_line_user', {
        p_member_id: selectedMemberId,
        p_line_user_id: phase.lineUserId,
        p_phone_last4: memberPhone4,
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
          name: checkin.data.name,
          activityTitle: checkin.data.activity_title,
          isGuest: false,
        });
      } else {
        setPhase({ kind: 'error', msg: checkin.data?.error ?? '報到失敗' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // 訪客綁定 + 報到
  async function handleGuestBind() {
    if (phase.kind !== 'guest_binding') return;
    if (!/^\d{4}$/.test(guestPhone4)) {
      alert('請輸入 4 位數字');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('guest_bind_and_checkin', {
        p_activity_id: activityId,
        p_token: token,
        p_line_user_id: phase.lineUserId,
        p_phone_last4: guestPhone4,
      });

      if (error) {
        alert('系統錯誤:' + error.message);
        return;
      }
      if (!data?.success) {
        alert(data?.error ?? '報到失敗');
        return;
      }

      sessionStorage.removeItem('liff_checkin_activity_id');
      sessionStorage.removeItem('liff_checkin_token');
      setPhase({
        kind: 'success',
        name: data.name,
        activityTitle: data.activity_title,
        isGuest: true,
      });
    } finally {
      setSubmitting(false);
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
            <p className="text-xl font-bold text-green-600 mb-2">
              {phase.isGuest ? '來賓報到成功' : '報到成功'}
            </p>
            <p className="text-gray-700">{phase.name}</p>
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

        {phase.kind === 'choose_identity' && (
          <div>
            <p className="text-sm text-gray-600 mb-4 text-center">
              Hi {phase.displayName},請選擇您的身份
            </p>
            <div className="space-y-3">
              <button
                onClick={chooseAsMember}
                className="w-full bg-red-600 text-white py-4 rounded-lg font-bold hover:bg-red-700"
              >
                我是會員
              </button>
              <button
                onClick={chooseAsGuest}
                className="w-full bg-blue-500 text-white py-4 rounded-lg font-bold hover:bg-blue-600"
              >
                我是來賓
              </button>
              <p className="text-xs text-gray-400 text-center mt-4">
                首次使用需要綁定,之後就不用再輸入了
              </p>
            </div>
          </div>
        )}

        {phase.kind === 'member_binding' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                會員綁定
              </p>
              <button
                onClick={() => setPhase({ kind: 'choose_identity', lineUserId: phase.lineUserId, displayName: phase.displayName })}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ← 返回
              </button>
            </div>
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
                  value={memberPhone4}
                  onChange={(e) => setMemberPhone4(e.target.value.replace(/\D/g, ''))}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="例如 1234"
                />
              </div>
              <button
                onClick={handleMemberBind}
                disabled={submitting}
                className="w-full bg-red-600 text-white py-3 rounded-lg disabled:opacity-50"
              >
                {submitting ? '綁定中...' : '綁定並報到'}
              </button>
            </div>
          </div>
        )}

        {phase.kind === 'guest_binding' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                來賓報到
              </p>
              <button
                onClick={() => setPhase({ kind: 'choose_identity', lineUserId: phase.lineUserId, displayName: phase.displayName })}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ← 返回
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              請先在網站報名此場活動,然後在這裡輸入您報名時填的手機末 4 碼
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">手機末 4 碼</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={4}
                  value={guestPhone4}
                  onChange={(e) => setGuestPhone4(e.target.value.replace(/\D/g, ''))}
                  className="w-full border rounded-lg px-3 py-2 text-lg"
                  placeholder="例如 1234"
                  autoFocus
                />
              </div>
              <button
                onClick={handleGuestBind}
                disabled={submitting}
                className="w-full bg-blue-500 text-white py-3 rounded-lg disabled:opacity-50"
              >
                {submitting ? '報到中...' : '綁定並報到'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
