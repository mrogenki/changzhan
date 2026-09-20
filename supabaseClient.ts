import { createClient } from '@supabase/supabase-js';

// ⚠️ 必須用靜態 import.meta.env.VITE_XXX；動態索引在 build 後會失效，
// 環境變數會被忽略而 fallback 到下面寫死的長展專案（開新分會時會安靜地接錯資料庫）。
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qxoglhkfxxqsjefynzqn.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4b2dsaGtmeHhxc2plZnluenFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzQwNTAsImV4cCI6MjA4NTYxMDA1MH0.gLvcHgY0rqLd26Nw61_M7nmjaz4TUsP9VL-XxN5wNSU';

// 全站共用單一 client，登入 session 透過 localStorage 由各處共享
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 管理員現以「Email＋密碼」登入。
// 舊帳號當初是用手機衍生的假信箱建立，登入頁在輸入未含 @ 時仍以此換算，作為向下相容。
export const phoneToEmail = (phone: string): string =>
  `${(phone || '').replace(/\D/g, '')}@changzhan.local`;
