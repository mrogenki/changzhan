# 從零開一套新分會系統

這個資料夾是整套系統的「可複製來源」。在此之前，資料庫結構與 edge function
只存在於正式環境的 Supabase 專案裡，等於沒有備份，也沒辦法開第二套。

```
supabase/
├── migrations/     資料庫結構（01→09 依序執行）
└── functions/      8 支 Edge Function 原始碼
```

---

## 一、建立 Supabase 專案

1. 開一個新的 Supabase 專案，區域選 **ap-northeast-1（東京）**。
2. 依序執行 `migrations/` 裡的 SQL（檔名前面的時間戳就是順序）：

| 檔案 | 內容 |
|---|---|
| `…000100_tables.sql` | 19 張資料表、序列、pgcrypto |
| `…000200_constraints_indexes.sql` | 主鍵／外鍵／check／索引 |
| `…000300_functions_core.sql` | 權限判斷（`is_changzhan_admin` 等）與共用函式 |
| `…000400_functions_liff.sql` | LIFF 報到、電子名片 |
| `…000500_functions_signup.sql` | 接龍報名四支 |
| `…000600_views_triggers.sql` | 2 個 view、4 個 trigger |
| `…000700_rls_policies.sql` | RLS（62 條政策） |
| `…000800_storage.sql` | 2 個 bucket 與其政策 |
| `…000900_grants.sql` | 撤掉內部函式對外的 EXECUTE |

用 Supabase Dashboard 的 SQL Editor 貼上執行即可，不需要 CLI。

**已驗證（真的開了一個全新的 Supabase 專案走完一遍，2026-09-20）**：
01→09 全部跑完後得到 19 張表、45 個索引、2 個 view、4 個 trigger、
19 支函式、62 條資料表政策、8 條 storage 政策、2 個 bucket，19 張表全開 RLS
——與長展正式環境一致。Supabase advisor 沒有任何 ERROR。

3. 建立第一個後台人員。**順序：先在 Dashboard 建 Auth 帳號，再寫 admins 表。**

   到 **Authentication → Users → Add user**，填 email 與密碼，**務必勾 Auto Confirm**。
   然後：

```sql
insert into public.admins (name, email, role, can_edit)
values ('你的名字', '跟上面一模一樣的@email', '總管理員', true);
```

**`admins.email` 與 Auth 帳號的 email 必須一致**，權限判斷是比對 JWT 裡的 email。

⚠️ **不要用前台的註冊流程建第一個帳號**（實測踩到）：
- 新專案的內建寄信服務額度極小，連續註冊兩次就回 `email rate limit exceeded`
- `.local` 與 `example.com` 這類網域會被擋成 `Email address is invalid`
  （長展的舊帳號是 `<手機>@changzhan.local`，這種格式在新專案建不起來）
- 手動 `insert into auth.users` 也不建議：GoTrue 假設 `confirmation_token`
  等欄位是空字串而不是 NULL，漏掉就會登入失敗並回
  `Database error querying schema`

---

## 二、部署 Edge Function

```bash
supabase functions deploy <name> --project-ref <新專案 ref>
```

`line-webhook` 要加 `--no-verify-jwt`（LINE 平台不會帶 JWT）。其餘 7 支維持預設。
**已驗證**：8 支全部部署成功，`line-webhook` 的 `verify_jwt` 確實是 false。

| Function | verify_jwt | 用途 |
|---|---|---|
| `line-webhook` | ❌ | LINE webhook 接收端，HMAC 驗簽、`!指令` 自動回覆 |
| `send-line-message` | ✅ | 1 對 1 推播 |
| `line-broadcast` | ✅ | 多群組推播（目前後台沒有介面呼叫它） |
| `line-notify-registration` | ✅ | 報名後推到指定群組 |
| `line-quota` | ✅ | 查本月推播額度 |
| `manage-admin` | ✅ | 後台人員管理（service role） |
| `send-registration-email` | ✅ | 報名確認信（Resend） |
| `invite-user` | ✅ | 邀請使用者 |

**Secrets**（Dashboard → Edge Functions → Secrets）：

- `LINE_CHANNEL_ACCESS_TOKEN`、`LINE_CHANNEL_SECRET`
- `RESEND_API_KEY`、`RESEND_FROM`
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 由 Supabase 自動注入，不用自己設

---

## 三、每家分會必須換掉的東西

程式裡仍有寫死的分會專屬資訊（約 35 處），開新客戶前要逐一處理：

- **環境變數**：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、
  `VITE_LIFF_CARD_ID`、`VITE_LIFF_SIGNUP_ID`、`VITE_LINE_OA_ID`、`VITE_BNI_REPORT_URL`
- **寫死在程式裡的**：分會名稱（`index.html`、`metadata.json`、數個頁面）、
  站台網域（`api/activity-og.ts`、`send-registration-email`、`line-webhook` 的 `SITE_URL`）、
  `line-webhook` 裡的 `LIFF_SIGNUP_ID` 常數
- **`constants.tsx`** 裡有長展的初始會員與活動資料，新分會要清空
- **函式命名**：`is_changzhan_admin()` / `is_changzhan_editor()` 含分會名。
  建議改成中性名稱（例如 `is_chapter_admin`），否則每家的 RLS 會長得不一樣

LINE 那層無法共用，每家都要自己申請：官方帳號、Messaging API channel、
3 個 LIFF app（報到／名片／接龍），以及 webhook 網址設定。

---

## 四、與正式環境的已知差異

`migrations/` 是「應該要有的樣子」，有兩處刻意與長展目前的正式環境不同：

1. **`activity-images` 的 storage 政策**：這裡是「公開讀、editor 才能寫」。
   長展正式環境仍是 public 角色無條件可寫可刪（等於任何人拿前端的 anon key
   就能上傳或刪除活動圖片與會員照片）。
2. **`attendance` 的重複 unique 約束**只保留一條。

另外這些是原樣保留、但新分會上線前建議一併處理的寬鬆設定：
`message_send_log` 的 anon 讀寫、`line_groups` 的 anon FOR ALL、
`guest_attendance_summary` view 仍是 SECURITY DEFINER。
細節寫在 `…000700_rls_policies.sql` 的註解裡。

---

## 五、實地演練的結果（2026-09-20）

開了一個全新 Supabase 專案 `chapter-template-test` 從頭走完，驗證過的項目：

| 項目 | 結果 |
|---|---|
| 9 份 migration 依序執行 | 全部成功，數量與正式環境一致 |
| 8 支 edge function 部署 | 全部成功 |
| Email + 密碼登入 | 成功取得 JWT |
| `is_changzhan_admin()` / `current_user_role()` | `true` / `admin` |
| 後台建立活動（editor 權限） | 成功 |
| 未登入者讀活動 | 看得到（公開頁面需要） |
| 未登入者讀會員／報名 | 回空陣列（RLS 擋下） |
| 公開報名 RPC | 成功寫入，寫入後仍讀不到別人的報名 |
| 報名確認信 function（未設 key） | 回 `{"ok":true,"skipped":"no_api_key"}`，不會讓報名看起來壞掉 |
| anon 上傳圖片 | 被 RLS 擋下 |
| Supabase advisor | 0 個 ERROR |

**演練中抓到並已修正的問題**：`current_user_role()` 與 `handle_new_user()`
直接參照 bni-report 的 `user_roles` 表。函式建得起來（plpgsql 不在建立時解析表名），
但一被呼叫就噴 `relation "public.user_roles" does not exist`——而 `member_aliases`
的 RLS 政策就會呼叫 `current_user_role()`，等於新分會一碰就炸。現在用 `to_regclass`
判斷表存在與否。

測試專案驗證完已刪除。
