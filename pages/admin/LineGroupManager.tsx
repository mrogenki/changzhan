import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  MessageSquare,
  Users,
  CheckSquare,
  Square,
  Image as ImageIcon,
  Loader2,
  X,
  Save,
  RefreshCw,
  AlertCircle,
  Bell,
  Gauge,
  AlertTriangle,
  Infinity as InfinityIcon,
  Megaphone,
  Power,
  PowerOff,
} from 'lucide-react';
import { AdminUser } from '../../types';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

interface LineGroup {
  id: number;
  line_group_id: string;
  name: string | null;
  description: string | null;
  is_active: boolean;
  joined_at: string;
  left_at: string | null;
}

interface SendLogRow {
  id: number;
  created_at: string;
  recipient_kind: string;
  line_user_id: string;
  message_text: string;
  status: 'sent' | 'failed';
  error_message: string | null;
  sent_by: string | null;
  batch_id: string | null;
}

interface QuotaInfo {
  type: 'limited' | 'none';
  limit: number | null;
  used: number;
  remaining: number | null;
}

interface Props {
  canEdit: boolean;
  currentUser: AdminUser;
  onUploadImage: (file: File) => Promise<string>;
}

const NOTIFY_SETTING_KEY = 'line_notify_registration_group_id';
const BOT_ENABLED_KEY = 'bot_reply_enabled';
const BOT_ANNOUNCEMENT_KEY = 'bot_reply_announcement_text';
const BOT_ANNOUNCEMENT_UPDATED_KEY = 'bot_reply_announcement_updated_at';

const LineGroupManager: React.FC<Props> = ({ canEdit, currentUser, onUploadImage }) => {
  const [groups, setGroups] = useState<LineGroup[]>([]);
  const [logs, setLogs] = useState<SendLogRow[]>([]);
  const [notifyGroupId, setNotifyGroupId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [savingNotify, setSavingNotify] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  // 自動回覆公告
  const [botEnabled, setBotEnabled] = useState(true);
  const [announcement, setAnnouncement] = useState('');
  const [announcementUpdatedAt, setAnnouncementUpdatedAt] = useState<string>('');
  const [savingBot, setSavingBot] = useState(false);

  // 編輯群組名稱
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const activeGroups = useMemo(() => groups.filter(g => g.is_active), [groups]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [groupRes, settingRes, logRes, botSettingsRes] = await Promise.all([
        supabase
          .from('line_groups')
          .select('*')
          .order('is_active', { ascending: false })
          .order('joined_at', { ascending: false }),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', NOTIFY_SETTING_KEY)
          .maybeSingle(),
        supabase
          .from('message_send_log')
          .select('*')
          .eq('recipient_kind', 'group')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('app_settings')
          .select('key, value')
          .in('key', [BOT_ENABLED_KEY, BOT_ANNOUNCEMENT_KEY, BOT_ANNOUNCEMENT_UPDATED_KEY]),
      ]);
      if (groupRes.data) setGroups(groupRes.data as LineGroup[]);
      if (settingRes.data) setNotifyGroupId(settingRes.data.value || '');
      if (logRes.data) setLogs(logRes.data as SendLogRow[]);
      if (botSettingsRes.data) {
        const map: Record<string, string> = {};
        botSettingsRes.data.forEach((r: any) => { map[r.key] = r.value ?? ''; });
        setBotEnabled((map[BOT_ENABLED_KEY] ?? 'true') !== 'false');
        setAnnouncement(map[BOT_ANNOUNCEMENT_KEY] ?? '');
        setAnnouncementUpdatedAt(map[BOT_ANNOUNCEMENT_UPDATED_KEY] ?? '');
      }
    } catch (e: any) {
      console.error(e);
      alert('載入失敗：' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const fetchQuota = async () => {
    setQuotaLoading(true);
    setQuotaError(null);
    try {
      const { data, error } = await supabase.functions.invoke('line-quota', { body: {} });
      if (error) {
        setQuotaError(error.message || '查詢失敗');
        setQuota(null);
        return;
      }
      if (data?.error) {
        setQuotaError(String(data.error));
        setQuota(null);
        return;
      }
      setQuota(data as QuotaInfo);
    } catch (e: any) {
      setQuotaError(e.message || String(e));
      setQuota(null);
    } finally {
      setQuotaLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    fetchQuota();
  }, []);

  // === 群組編輯 ===
  const startEdit = (g: LineGroup) => {
    setEditingId(g.id);
    setEditName(g.name || '');
    setEditDesc(g.description || '');
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDesc('');
  };
  const saveEdit = async (id: number) => {
    if (!canEdit) {
      alert('你的帳號為「僅檢視」權限，無法執行此操作。');
      return;
    }

    const { error } = await supabase
      .from('line_groups')
      .update({ name: editName.trim() || null, description: editDesc.trim() || null })
      .eq('id', id);
    if (error) {
      alert('儲存失敗：' + error.message);
      return;
    }
    cancelEdit();
    fetchAll();
  };
  const toggleActive = async (g: LineGroup) => {
    if (!canEdit) {
      alert('你的帳號為「僅檢視」權限，無法執行此操作。');
      return;
    }

    const { error } = await supabase
      .from('line_groups')
      .update({ is_active: !g.is_active, left_at: g.is_active ? new Date().toISOString() : null })
      .eq('id', g.id);
    if (error) {
      alert('切換狀態失敗：' + error.message);
      return;
    }
    fetchAll();
  };

  // === 自動回覆公告設定 ===
  const saveBotSettings = async () => {
    if (!canEdit) {
      alert('你的帳號為「僅檢視」權限，無法執行此操作。');
      return;
    }

    setSavingBot(true);
    try {
      const nowIso = new Date().toISOString();
      const rows = [
        { key: BOT_ENABLED_KEY, value: botEnabled ? 'true' : 'false', updated_at: nowIso },
        { key: BOT_ANNOUNCEMENT_KEY, value: announcement, updated_at: nowIso },
        { key: BOT_ANNOUNCEMENT_UPDATED_KEY, value: nowIso, updated_at: nowIso },
      ];
      const { error } = await supabase
        .from('app_settings')
        .upsert(rows, { onConflict: 'key' });
      if (error) {
        alert('儲存失敗：' + error.message);
        return;
      }
      setAnnouncementUpdatedAt(nowIso);
      alert('已儲存自動回覆設定');
    } finally {
      setSavingBot(false);
    }
  };

  // === 報名通知群組設定 ===
  const saveNotifySetting = async () => {
    if (!canEdit) {
      alert('你的帳號為「僅檢視」權限，無法執行此操作。');
      return;
    }

    setSavingNotify(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { key: NOTIFY_SETTING_KEY, value: notifyGroupId, updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      if (error) {
        alert('儲存失敗：' + error.message);
        return;
      }
      alert('已儲存報名通知群組設定');
    } finally {
      setSavingNotify(false);
    }
  };

  // 群發相關的 state 與 handler 已隨「群發公告」一併移除（避免誤觸消耗推播額度）


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare size={28} className="text-green-600" />
          LINE 長展小幫手
        </h1>
        <button
          onClick={() => { fetchAll(); fetchQuota(); }}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <RefreshCw size={16} /> 重新整理
        </button>
      </div>

      {/* === 額度卡片 === */}
      <QuotaCard
        quota={quota}
        loading={quotaLoading}
        error={quotaError}
        onRefresh={fetchQuota}
      />


      {/* === 區塊 0: 自動回覆公告（!公告 指令） === */}
      <section className="bg-white rounded-xl shadow p-6">
        <div className="flex items-start justify-between mb-4 gap-4">
          <div className="flex items-center gap-2">
            <Megaphone size={20} className="text-emerald-600" />
            <h2 className="text-xl font-bold">自動回覆公告</h2>
          </div>
          <button
            onClick={() => setBotEnabled(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              botEnabled
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
            }`}
            title="按一下切換啟用/停用，記得儲存"
          >
            {botEnabled ? <Power size={12} /> : <PowerOff size={12} />}
            {botEnabled ? '已啟用' : '已停用'}
          </button>
        </div>

        <div className="text-sm text-gray-600 mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 leading-relaxed">
          <p className="font-medium text-emerald-900 mb-1">💡 完全免費（透過 LINE Reply API）</p>
          <p>群組裡任何成員打 <code className="bg-white px-1.5 py-0.5 rounded text-emerald-700 font-mono">!公告</code> 等指令，bot 會自動回覆。不算進每月推播額度。</p>
          <p className="mt-1">支援指令：<code className="bg-white px-1 rounded">!公告</code> <code className="bg-white px-1 rounded">!活動</code> <code className="bg-white px-1 rounded">!例會</code> <code className="bg-white px-1 rounded">!咖啡</code> <code className="bg-white px-1 rounded">!培訓</code> <code className="bg-white px-1 rounded">!幫助</code></p>
          <p className="mt-1 text-emerald-800">活動類指令會自動撈 DB 最新資料，這裡只需編輯 <code className="bg-white px-1 rounded">!公告</code> 內容。</p>
        </div>

        <label className="block font-medium mb-2">
          📣 <code className="font-mono">!公告</code> 回覆內容
        </label>
        <textarea
          value={announcement}
          onChange={e => setAnnouncement(e.target.value)}
          rows={6}
          placeholder="例：&#10;本週主題：客戶開發三大關鍵&#10;時間：週二 06:30&#10;地點：88號樂章&#10;歡迎邀請朋友參與！"
          className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          {announcementUpdatedAt
            ? `上次更新：${new Date(announcementUpdatedAt).toLocaleString('zh-TW')}`
            : '尚未設定過'}
        </p>

        <div className="mt-3 flex flex-col sm:flex-row gap-3 sm:items-center">
          <button
            onClick={saveBotSettings}
            disabled={savingBot}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {savingBot ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            儲存
          </button>
          <span className="text-xs text-gray-500">
            儲存後群組裡馬上可用，不需重啟服務。
          </span>
        </div>

        {/* 預覽 */}
        {announcement.trim() && (
          <details className="mt-4">
            <summary className="text-sm text-emerald-700 cursor-pointer hover:underline">
              👁 預覽 LINE 回覆畫面
            </summary>
            <div className="mt-2 p-3 bg-gray-100 rounded-lg max-w-md">
              <div className="bg-white rounded-lg p-3 shadow-sm whitespace-pre-line text-sm">
                <div className="font-bold mb-1">📣 最新公告</div>
                <div>{announcement}</div>
              </div>
            </div>
          </details>
        )}
      </section>

      {/* === 區塊 1: 報名通知設定 === */}
      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Bell size={20} className="text-amber-500" />
          報名通知群組
        </h2>
        <p className="text-sm text-gray-600 mb-3">
          有人在活動詳情頁報名後，會自動推送通知到所選群組。留空 = 不通知。
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={notifyGroupId}
            onChange={e => setNotifyGroupId(e.target.value)}
            className="flex-grow border rounded-lg px-3 py-2 bg-white"
          >
            <option value="">— 不通知 —</option>
            {activeGroups.map(g => (
              <option key={g.id} value={g.line_group_id}>
                {g.name || g.line_group_id.slice(0, 12) + '…'}
              </option>
            ))}
          </select>
          <button
            onClick={saveNotifySetting}
            disabled={savingNotify}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {savingNotify ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            儲存
          </button>
        </div>
      </section>

      {/* === 區塊 2: 群組清單 === */}
      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Users size={20} className="text-blue-500" />
          群組清單 <span className="text-sm font-normal text-gray-500">({activeGroups.length} 個 active)</span>
        </h2>
        {loading ? (
          <div className="py-8 text-center text-gray-500">
            <Loader2 size={24} className="animate-spin inline mr-2" />載入中…
          </div>
        ) : groups.length === 0 ? (
          <div className="py-8 text-center text-gray-500 bg-gray-50 rounded-lg">
            <AlertCircle size={24} className="inline mr-2" />
            尚無群組。請先把長展小幫手加入 LINE 群組，bot 收到 join 事件後會自動出現在此清單。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="py-2 pr-4">名稱 / 描述</th>
                  <th className="py-2 pr-4">Group ID</th>
                  <th className="py-2 pr-4">加入時間</th>
                  <th className="py-2 pr-4">狀態</th>
                  <th className="py-2 pr-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 pr-4">
                      {editingId === g.id ? (
                        <div className="space-y-1">
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            placeholder="群組名稱"
                            className="border rounded px-2 py-1 w-full"
                          />
                          <input
                            value={editDesc}
                            onChange={e => setEditDesc(e.target.value)}
                            placeholder="描述（選填）"
                            className="border rounded px-2 py-1 w-full text-xs"
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium">{g.name || <span className="text-gray-400">未命名</span>}</div>
                          {g.description && <div className="text-xs text-gray-500">{g.description}</div>}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-500">
                      {g.line_group_id.slice(0, 12)}…
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-500">
                      {new Date(g.joined_at).toLocaleDateString('zh-TW')}
                    </td>
                    <td className="py-2 pr-4">
                      {g.is_active ? (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">在線</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">離開</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {editingId === g.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => saveEdit(g.id)}
                            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            存檔
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(g)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            編輯
                          </button>
                          <button
                            onClick={() => toggleActive(g)}
                            className="text-xs text-gray-600 hover:underline"
                          >
                            {g.is_active ? '標記離開' : '標記在線'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 群發公告已停用：避免誤觸消耗 LINE 推播額度。
          UI 與 handleSend 一併移除，line-broadcast edge function 仍在（未刪），
          要恢復請看 git 歷史（commit 訊息含「群發」）。 */}

      {/* === 區塊 4: 發送紀錄 === */}
      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold mb-4">最近發送紀錄</h2>
        {logs.length === 0 ? (
          <div className="text-gray-500 text-sm">尚無發送紀錄</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="py-2 pr-4">時間</th>
                  <th className="py-2 pr-4">群組</th>
                  <th className="py-2 pr-4">內容</th>
                  <th className="py-2 pr-4">發送者</th>
                  <th className="py-2 pr-4">狀態</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => {
                  const grp = groups.find(g => g.line_group_id === l.line_user_id);
                  return (
                    <tr key={l.id} className="border-b">
                      <td className="py-2 pr-4 text-xs whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString('zh-TW')}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {grp?.name || <span className="font-mono text-gray-400">{l.line_user_id.slice(0, 10)}…</span>}
                      </td>
                      <td className="py-2 pr-4 max-w-md truncate" title={l.message_text}>
                        {l.message_text}
                      </td>
                      <td className="py-2 pr-4 text-xs text-gray-500">{l.sent_by || '-'}</td>
                      <td className="py-2 pr-4">
                        {l.status === 'sent' ? (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">成功</span>
                        ) : (
                          <span
                            className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded"
                            title={l.error_message || ''}
                          >
                            失敗
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

// =====================================================
// QuotaCard：本月推播額度顯示
// =====================================================
const QuotaCard: React.FC<{
  quota: QuotaInfo | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}> = ({ quota, loading, error, onRefresh }) => {
  // 不限額方案
  if (quota?.type === 'none') {
    return (
      <section className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <InfinityIcon size={28} className="text-emerald-600" />
            <div>
              <div className="text-sm text-emerald-700 font-medium">推播方案</div>
              <div className="text-2xl font-bold text-emerald-900">不限額</div>
              <div className="text-xs text-emerald-700 mt-0.5">
                本月已用 {quota.used.toLocaleString()} 則
              </div>
            </div>
          </div>
          <button onClick={onRefresh} disabled={loading} className="text-sm text-emerald-700 hover:text-emerald-900 flex items-center gap-1">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            更新
          </button>
        </div>
      </section>
    );
  }

  // 限額方案
  if (quota?.type === 'limited' && quota.limit !== null) {
    const used = quota.used;
    const limit = quota.limit;
    const remaining = quota.remaining ?? 0;
    const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    let tone: 'ok' | 'warn' | 'danger' = 'ok';
    if (pct >= 100) tone = 'danger';
    else if (pct >= 80) tone = 'warn';

    const colorMap = {
      ok:     { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-900',    sub: 'text-blue-700',    bar: 'bg-blue-500',   icon: 'text-blue-600' },
      warn:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-900',   sub: 'text-amber-700',   bar: 'bg-amber-500',  icon: 'text-amber-600' },
      danger: { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-900',     sub: 'text-red-700',     bar: 'bg-red-500',    icon: 'text-red-600' },
    } as const;
    const c = colorMap[tone];

    return (
      <section className={`${c.bg} border ${c.border} rounded-xl p-5`}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {tone === 'danger' ? (
              <AlertTriangle size={28} className={c.icon + ' flex-shrink-0'} />
            ) : (
              <Gauge size={28} className={c.icon + ' flex-shrink-0'} />
            )}
            <div className="min-w-0">
              <div className={`text-sm font-medium ${c.sub}`}>本月推播額度</div>
              <div className={`text-2xl font-bold ${c.text}`}>
                {used.toLocaleString()} / {limit.toLocaleString()}
                <span className={`ml-2 text-base font-normal ${c.sub}`}>
                  剩 {remaining.toLocaleString()}
                </span>
              </div>
              {tone === 'danger' && (
                <div className="text-xs text-red-700 mt-1 font-medium">
                  ⚠️ 額度已滿，本月再發會收到 LINE 429 錯誤
                </div>
              )}
              {tone === 'warn' && (
                <div className="text-xs text-amber-700 mt-1 font-medium">
                  ⚠️ 額度即將用盡，建議升級方案或減少群發
                </div>
              )}
              <div className={`text-xs ${c.sub} mt-1`}>
                每月 1 號 GMT 重置 · 1 個群組 = 1 則
              </div>
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className={`text-sm ${c.sub} hover:${c.text} flex items-center gap-1 flex-shrink-0`}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            更新
          </button>
        </div>
        {/* 進度條 */}
        <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden">
          <div
            className={`h-full ${c.bar} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className={`text-xs ${c.sub} mt-1 text-right`}>{pct}% 已使用</div>
      </section>
    );
  }

  // loading / error / 尚未取得
  return (
    <section className="bg-gray-50 border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gauge size={24} className="text-gray-400" />
          <div>
            <div className="text-sm font-medium text-gray-600">本月推播額度</div>
            {loading ? (
              <div className="text-gray-500 text-sm flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> 查詢中…
              </div>
            ) : error ? (
              <div className="text-red-600 text-sm">查詢失敗：{error}</div>
            ) : (
              <div className="text-gray-500 text-sm">尚未取得</div>
            )}
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          <RefreshCw size={14} /> 重試
        </button>
      </div>
    </section>
  );
};

export default LineGroupManager;
