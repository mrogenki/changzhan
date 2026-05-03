import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  MessageSquare,
  Send,
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
  currentUser: AdminUser;
  onUploadImage: (file: File) => Promise<string>;
}

const NOTIFY_SETTING_KEY = 'line_notify_registration_group_id';

const LineGroupManager: React.FC<Props> = ({ currentUser, onUploadImage }) => {
  const [groups, setGroups] = useState<LineGroup[]>([]);
  const [logs, setLogs] = useState<SendLogRow[]>([]);
  const [notifyGroupId, setNotifyGroupId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [savingNotify, setSavingNotify] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  // Broadcast composer
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  // 編輯群組名稱
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const activeGroups = useMemo(() => groups.filter(g => g.is_active), [groups]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [groupRes, settingRes, logRes] = await Promise.all([
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
      ]);
      if (groupRes.data) setGroups(groupRes.data as LineGroup[]);
      if (settingRes.data) setNotifyGroupId(settingRes.data.value || '');
      if (logRes.data) setLogs(logRes.data as SendLogRow[]);
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

  // === 報名通知群組設定 ===
  const saveNotifySetting = async () => {
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

  // === 群發 ===
  const toggleSelect = (gid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(activeGroups.map(g => g.line_group_id)));
  const clearAll = () => setSelected(new Set());

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      setImageUrl(url);
    } catch (err: any) {
      alert('圖片上傳失敗：' + (err.message || err));
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (selected.size === 0) {
      alert('請至少選一個群組');
      return;
    }
    if (!text.trim() && !imageUrl) {
      alert('請輸入文字或上傳圖片');
      return;
    }

    // 額度預警：群數 > 剩餘額度
    if (quota?.type === 'limited' && quota.remaining !== null && selected.size > quota.remaining) {
      const cont = confirm(
        `⚠️ 額度警告\n\n` +
        `本月剩餘 ${quota.remaining} 則，但你選了 ${selected.size} 個群組。\n` +
        `送出後會有 ${selected.size - quota.remaining} 個群組失敗（LINE 會回 429）。\n\n` +
        `仍要繼續嗎？`,
      );
      if (!cont) return;
    } else if (!confirm(`確定要發送給 ${selected.size} 個群組？`)) {
      return;
    }

    setSending(true);
    try {
      const messages: any[] = [];
      if (text.trim()) messages.push({ type: 'text', text: text.trim() });
      if (imageUrl) {
        messages.push({
          type: 'image',
          originalContentUrl: imageUrl,
          previewImageUrl: imageUrl,
        });
      }

      const { data, error } = await supabase.functions.invoke('line-broadcast', {
        body: {
          groupIds: Array.from(selected),
          messages,
          sentBy: currentUser.name,
        },
      });

      if (error) {
        alert('發送失敗：' + error.message);
        return;
      }
      if (data?.summary) {
        const { sent, failed, total } = data.summary;
        alert(`發送完成：${sent}/${total} 成功，${failed} 失敗`);
        setText('');
        setImageUrl('');
        setSelected(new Set());
        fetchAll();
        fetchQuota();
      } else {
        alert('發送回應異常：' + JSON.stringify(data));
      }
    } catch (err: any) {
      alert('發送失敗：' + (err.message || err));
    } finally {
      setSending(false);
    }
  };

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

      {/* === 區塊 3: 群發公告 === */}
      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Send size={20} className="text-red-600" />
          群發公告
        </h2>

        {activeGroups.length === 0 ? (
          <div className="py-6 text-center text-gray-500 bg-gray-50 rounded-lg">
            目前沒有可發送的群組
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="font-medium">選擇群組（{selected.size} / {activeGroups.length}）</label>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    全選
                  </button>
                  <button
                    onClick={clearAll}
                    className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    清除
                  </button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {activeGroups.map(g => {
                  const checked = selected.has(g.line_group_id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleSelect(g.line_group_id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 ${
                        checked ? 'bg-blue-50' : ''
                      }`}
                    >
                      {checked ? (
                        <CheckSquare size={18} className="text-blue-600 flex-shrink-0" />
                      ) : (
                        <Square size={18} className="text-gray-400 flex-shrink-0" />
                      )}
                      <span className="font-medium">{g.name || '(未命名)'}</span>
                      <span className="text-xs text-gray-400 ml-auto font-mono">
                        {g.line_group_id.slice(0, 8)}…
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <label className="block font-medium mb-2">訊息文字</label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={5}
                placeholder="輸入要發送的文字（可空，但需至少有圖片）"
                className="w-full border rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                建議單則訊息不超過 500 字。LINE 群組內 bot 訊息會直接顯示。
              </p>
            </div>

            <div className="mb-4">
              <label className="block font-medium mb-2">圖片（選填）</label>
              {imageUrl ? (
                <div className="relative inline-block">
                  <img src={imageUrl} alt="預覽" className="max-h-48 rounded-lg border" />
                  <button
                    onClick={() => setImageUrl('')}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    title="移除圖片"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                  {uploading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ImageIcon size={18} />
                  )}
                  <span className="text-sm">{uploading ? '上傳中…' : '選擇圖片'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              )}
            </div>

            <button
              onClick={handleSend}
              disabled={sending || selected.size === 0 || (!text.trim() && !imageUrl)}
              className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  發送中…
                </>
              ) : (
                <>
                  <Send size={18} />
                  發送到 {selected.size} 個群組
                </>
              )}
            </button>
          </>
        )}
      </section>

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
