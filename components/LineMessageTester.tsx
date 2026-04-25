import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Send } from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

type Recipient = {
  kind: 'member' | 'guest';
  id: number;
  name: string;
  line_user_id: string;
};

export default function LineMessageTester() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [message, setMessage] = useState('測試訊息:來自 BNI 長展分會系統');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // 撈所有已綁 LINE 的會員 + 來賓
      const [membersRes, guestsRes] = await Promise.all([
        supabase.from('members').select('id, name, line_user_id').not('line_user_id', 'is', null),
        supabase.from('guests').select('id, name, line_user_id'),
      ]);

      const members: Recipient[] = (membersRes.data ?? []).map((m: any) => ({
        kind: 'member', id: m.id, name: m.name, line_user_id: m.line_user_id,
      }));
      const guests: Recipient[] = (guestsRes.data ?? []).map((g: any) => ({
        kind: 'guest', id: g.id, name: g.name, line_user_id: g.line_user_id,
      }));

      setRecipients([...members, ...guests]);
      setLoading(false);
    })();
  }, []);

  async function handleSend() {
    if (!selectedKey) {
      alert('請選擇收件人');
      return;
    }
    if (!message.trim()) {
      alert('請輸入訊息內容');
      return;
    }

    const recipient = recipients.find(r => `${r.kind}:${r.id}` === selectedKey);
    if (!recipient) return;

    setSending(true);
    setResult(null);
    try {
      // 呼叫 Edge Function (Supabase JS client 會自動帶 anon key)
      const { data, error } = await supabase.functions.invoke('send-line-message', {
        body: {
          to: recipient.line_user_id,
          messages: [{ type: 'text', text: message }],
        },
      });

      if (error) {
        setResult({ ok: false, msg: '呼叫失敗:' + error.message });
        return;
      }
      if (data?.success) {
        setResult({ ok: true, msg: `已送出給 ${recipient.name}` });
      } else {
        setResult({ ok: false, msg: data?.error ?? '未知錯誤' });
      }
    } catch (err: any) {
      setResult({ ok: false, msg: '錯誤:' + (err?.message ?? String(err)) });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white border rounded-lg p-6">
        <p className="text-sm text-gray-400">載入收件人清單...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-1">LINE 訊息測試</h3>
      <p className="text-xs text-gray-500 mb-4">
        測試 Edge Function 是否能正確發送 LINE 訊息(僅限已綁定 LINE 的會員/來賓)
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">收件人 ({recipients.length} 位可選)</label>
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">-- 選擇收件人 --</option>
            <optgroup label="會員">
              {recipients.filter(r => r.kind === 'member').map(r => (
                <option key={`member:${r.id}`} value={`member:${r.id}`}>{r.name}</option>
              ))}
            </optgroup>
            <optgroup label="來賓">
              {recipients.filter(r => r.kind === 'guest').map(r => (
                <option key={`guest:${r.id}`} value={`guest:${r.id}`}>{r.name}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">訊息內容</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="輸入要發送的訊息..."
          />
        </div>

        <button
          onClick={handleSend}
          disabled={sending || !selectedKey}
          className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          <Send size={16} />
          {sending ? '發送中...' : '發送測試訊息'}
        </button>

        {result && (
          <div className={`text-sm p-3 rounded-lg ${
            result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {result.ok ? '✅' : '⚠️'} {result.msg}
          </div>
        )}
      </div>
    </div>
  );
}
