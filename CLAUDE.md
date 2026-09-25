# BNI 長展分會官方網站 — Claude Code 專案文件

> 給 Claude Code 的專案說明。每次開啟此專案請先讀這份文件。

---

## ⚠️ 安全提醒

**請勿將實際金鑰、Token、密碼等明文寫入此檔案或程式碼。** 這份 CLAUDE.md 會 commit 進 repo。

所有機密值的存放位置：

| 類型 | 存放位置 |
|------|---------|
| 前端 client-side 環境變數 | `.env.local`（已在 `.gitignore`） |
| Vercel 部署環境變數 | Vercel 專案 Settings → Environment Variables |
| Supabase Edge Function secrets | Supabase Dashboard → Edge Functions → Secrets |

修改此文件時，若需引用機密值，請以 placeholder 呈現（例如 `<從 Supabase Dashboard 取得>`）。

---

## 一、專案概覽

**系統名稱：** BNI 長展分會官方網站 / changzhan
**用途：** BNI 長展分會的對外活動報名平台 + LINE 簽到流程 + 後台管理（會員、活動、出席記錄、財務、文件管理）
**主要使用者：**
- 會員 / 訪客（瀏覽活動、報名、簽到）
- 幹部 / Admin（後台管理）
- LINE 用戶（透過 LIFF 內嵌頁簽到）

### 技術架構

| 層 | 技術 | 部署位置 |
|---|---|---|
| 前端 | Vite + React 18/19 + TailwindCSS 4 + react-router-dom | Vercel |
| 後端 | Supabase（PostgreSQL + Auth + Storage） | ap-northeast-1（東京）|
| LINE 整合 | @line/liff（LIFF SDK） | LINE Platform |
| Email | Resend API（`send-registration-email` edge function）| Supabase Edge Functions |
| 動態 OG tags | Vercel Serverless Function（`api/activity-og.ts`）| Vercel |
| 動畫 / UI | framer-motion + motion + lucide-react + qrcode.react | — |
| Excel | xlsx package（client-side parsing） | 瀏覽器 |
| 原始碼 | GitHub | `github.com/mrogenki/changzhan`（public） |

---

## 二、與 bni-report 的關係（**重要**）

這個系統 **與 [`bni-report`](https://github.com/mrogenki/bni-report) 共用同一個 Supabase project**：

- **Supabase Project ID**：`qxoglhkfxxqsjefynzqn`（名稱：changzhan）
- **共用 tables**：`user_roles`（共用 RBAC）
- **共用 functions**：`current_user_role()` SECURITY DEFINER（兩個系統的 RLS 都依賴此函式）

⚠️ **動 RLS 政策或 SECURITY DEFINER functions 前要先檢查 bni-report 是否依賴**，反之亦然。

### 統一入口（不合併程式碼）

兩系統共用同一 Supabase project 與 Supabase Auth，登入 session 相通。changzhan 後台側欄提供「**引薦單報告**」外部連結（新分頁開啟 bni-report），入口網址由環境變數 `VITE_BNI_REPORT_URL` 提供（未設定則不顯示）。**未把 bni-report 程式碼併入**——評估後確認合併不省 Supabase/Vercel 費用（已共用/非按專案計費），故只做統一入口。

### 各系統獨佔的 tables

**本系統（changzhan）獨佔**：`activities`、`admins`、`registrations`、`members`、`attendance`、`finance_records`、`milestones`、`guests`、`app_settings`、`message_send_log`、`documents`、`line_groups`

**bni-report 獨佔**：`palms_imports`、`traffic_light_imports`、`member_groups`

---

## 三、前端結構

### 入口
- `index.tsx` — React entry
- `App.tsx`（~28 KB）— 主路由設定
- `constants.tsx`（~36 KB）— 大量 hard-coded 設定

### 頁面（`pages/`）

| 路由 / 頁面 | 用途 |
|------------|------|
| `Home.tsx` | 首頁，公開瀏覽 |
| `ActivityDetail.tsx` | 活動詳情頁（`/activity/:id`，server.ts 會動態注入 OG tags） |
| `RegularMeeting.tsx` | 商務例會頁面 |
| `GroupMeeting.tsx` | 組聚頁面（`/group-meeting`；舊路徑 `/coffee` 轉址過來）|
| `BusinessTraining.tsx` | 商務培訓頁面 |
| `Calendar.tsx` | 公開活動行事曆（`/calendar`，月曆格狀）|
| `Milestones.tsx` | 大事記 |
| `MemberList.tsx` | 會員列表 |
| `LiffCheckin.tsx` | LINE LIFF 內嵌簽到頁 |
| `LiffSignup.tsx` | 接龍報名 LIFF 頁（`/liff/signup?sheet=<token>`），見第九之四節 |
| `LiffCard.tsx` | LINE LIFF 電子名片分享頁（`/liff/card?member=<id>` 或 `?ids=1,2,3`，用 `liff.shareTargetPicker` 讓使用者把會員名片直接分享給 LINE 好友/群組）|
| `LoginPage.tsx` | 後台登入（Supabase Auth，**Email + 密碼**；輸入未含 `@` 時會用手機衍生舊信箱 `<數字>@changzhan.local` 當向下相容）|
| `AdminDashboard.tsx` | 後台主頁 |
| `admin/` | 後台子頁面（待補充細節） |

### 元件（`components/`）

- `ActivityListView.tsx` — 活動列表
- `CheckinQrPanel.tsx` — 簽到 QR Code 顯示
- `LineFloatingButton.tsx` — LINE 浮動按鈕
- `LineMessageTester.tsx` — LINE 訊息測試工具

---

## 四、動態 OG tags（`api/activity-og.ts`）

把 `/activity/:id` 貼到 LINE / Facebook 時，預覽要顯示**該場活動**的標題、時間地點與封面。本站是 SPA，爬蟲不執行 JS，所以必須在伺服器端把 meta 塞進 HTML。

**怎麼運作：**

1. `vercel.json` 把 `/activity/:id` rewrite 到 `/api/activity-og?id=:id`（**這條要排在 SPA 的 catch-all rewrite 前面**，Vercel 是第一條命中優先）
2. 函式讀 build 好的 `dist/index.html`（靠 `vercel.json` 的 `includeFiles` 帶進函式；讀不到時退而跟自己網域抓 `/index.html`）
3. 用 Supabase REST 撈該活動（2.5 秒逾時），替換掉 head 裡的 `<title>` / `description` / `og:*` / `twitter:*`，並補上 `og:url`
4. 原樣吐回同一份 index.html，所以**一般使用者拿到的仍是完整 SPA**，只有 meta 不同

**注意事項：**

- **失敗一律 fallback 成原本的 index.html**：預覽圖不對只是不好看，活動頁打不開才是真的壞掉。
- **走 `activity_og` view 而不是 `activities`**：早期 5 筆活動的 `picture` 存的是 base64 data URI（最大 200KB），爬蟲不吃 `data:` 當 og:image。view 直接在 DB 端把非 `http(s)` 的值濾成 null（`security_invoker = true`，沿用 activities 自己的 RLS），回應從 203KB 降到 153 bytes。**實測**：原本直接查 `activities` 時，冷啟動撈 200KB 會超過 2.5 秒逾時而退回預設 OG。
- **撈不到活動時只快取 30 秒**（撈到才 `s-maxage=300`）。否則一次逾時就會讓錯誤的預覽在 CDN 上黏 5 分鐘——這個坑實際踩過。
- **本機 `npm run dev` 不會跑這支函式**（純 vite dev server），本機看活動頁只會拿到 index.html 的預設 OG tags。要驗證請部署後用 `curl -s https://changzhan.vercel.app/activity/<id> | head -40` 看 meta。
- 改完 OG 之後，LINE / Facebook 有快取，要用各自的 debugger 重新抓取才看得到新預覽。

> 歷史：原本有一支 `server.ts`（Express + Vite middleware）想做這件事，但從來沒被接上——`dev`/`build` 都是純 vite、`vercel.json` 只有 SPA rewrite、`express` 連裝都沒裝，而且 `index.html` 早就沒有它要替換的 `__OG_TITLE__` placeholder 了。已刪除，改由本節的函式取代。

## 五、Supabase 資料表

### 本系統使用的（12 張）

| Table | 說明 |
|-------|------|
| `activities` | 活動資料（id, title, date, time, location, picture 等）。`price` 是**一般價**，`member_price` 是**會員價**（null = 不分級）。另有 `activity_og` view 供 OG function 用，見第四節 |
| `admins` | 後台管理員（`name`/`email`/`role`/`can_edit`；`email` 即登入帳號。`phone`、`password` 為舊欄位，已不再使用）|
| `registrations` | 活動報名記錄（含 `notes` 備註，供來賓管理裡尚未綁定 LINE 的列使用）|
| `members` | 會員資料 |
| `attendance` | 出席記錄（⚠️ 目前 **RLS 未啟用**，需修） |
| `guests` | 訪客資料（含 `notes` 備註）|
| `finance_records` | 財務記錄（多一個 `payment_batch_id`，供收款工具寫入時識別是哪個收款項目）|
| `signup_sheets` | 接龍（含公開連結用的隨機 `token`）|
| `signup_entries` | 接龍的每筆報名 |
| `payable_records` | 應付帳款（即將發生的支出），見第九之六節 |
| `payment_batches` | 收款項目（每月餐費、某場活動收費…），見第九之三節 |
| `payment_items` | 收款明細，每人一筆，掛在 `payment_batches` 底下 |
| `milestones` | 大事記 |
| `app_settings` | 系統設定（key/value，例：`line_notify_registration_group_id`） |
| `message_send_log` | LINE 訊息發送記錄（`recipient_kind`: member / guest / **group**） |
| `email_send_log` | 報名確認信發送記錄（`status`: sent / failed / skipped），只有後台登入者讀得到 |
| `documents` | 文件管理 |
| `line_groups` | LINE 長展小幫手所在群組（`line_group_id`, `name`, `is_active`，由 `line-webhook` 自動寫入） |

### 共用（與 bni-report）

- `user_roles` — RBAC 三角色 (admin / editor / viewer)，搭配 JWT app_metadata.role

### Storage Buckets

- `activity-images` — 活動圖片
- `chapter-documents` — 分會文件

---

## 六、SECURITY DEFINER Functions（共用）

以下函式 anon 與 authenticated 都可呼叫（部分為了 LIFF 公開簽到流程必要）：

| Function | 用途 |
|----------|------|
| `bind_line_user(p_member_id, p_line_user_id, p_phone_last4)` | 會員綁定 LINE 帳號 |
| `current_user_role()` | 取得當前使用者角色（RLS 依賴）|
| `guest_bind_and_checkin(p_activity_id, p_token, p_line_user_id, p_phone_last4)` | 訪客綁定 + 簽到 |
| `handle_new_user()` | 新使用者初始化 |
| `line_checkin(p_activity_id, p_token, p_line_user_id)` | LINE 簽到主流程 |
| `sync_role_to_jwt()` | 把角色同步到 JWT |
| `check_message_recently_sent(p_line_user_id, p_message_hash, p_window_hours)` | 訊息防重複發送 |
| `public_signup_sheet(p_token, p_viewer_line_user_id)` | 接龍公開頁：回傳接龍資訊與名單。**只回姓名與帶幾位**，不回電話；也不回其他人的 `line_user_id`（改回 `is_me` 布林值） |
| `public_signup_join(...)` | 接龍報名／修改。檢查截止、人數上限（以總人頭計）、限會員設定、非會員必填電話 |
| `public_signup_cancel(p_token, p_line_user_id)` | 取消報名 |
| `public_signup_prefill(p_line_user_id)` | 帶入這個人先前填過的姓名電話（會員直接用會員資料），免得每次重打 |
| `public_member_cards(p_ids bigint[])` | 電子名片：回傳指定會員的名片欄位（含 `mobile_phone`/`email`，僅 active，依傳入順序）。供 `LiffCard.tsx`（anon）取單/多位會員資料。⚠️ 對 anon 開放電話+email，屬可被逐 id 爬取的個資，若要收緊可改為需登入或加頻率限制 |

⚠️ Supabase advisor 對這些都有 `anon_security_definer_function_executable` warning，但部分函式**必須對 anon 開放**（如 LIFF 簽到流程的訪客）。動權限前要先確認流程不會壞。

---

## 六之一、可複製性（`supabase/`）

整套系統現在可以從零重建：`supabase/migrations/` 是資料庫結構（19 張表、
47 約束、45 索引、2 view、4 trigger、62 條 RLS 政策），`supabase/functions/`
是 8 支 edge function 的原始碼。步驟寫在 `supabase/README.md`。

**在此之前，DB 結構與 7 支 edge function 只存在於正式環境的 Supabase 上**
——等於沒有備份，也沒辦法開第二套給別的分會。

**已驗證**：2026-09-20 在一個拋棄式 schema 上從零跑完 01→07，數量與正式
環境一致，測完即刪。過程中抓到一個真實問題：`signup_sheets.token` 的預設值
用到 pgcrypto 的 `gen_random_bytes()`，Supabase 把擴充套件裝在 `extensions`
schema、不在預設 search_path 裡，所以 migration 必須明確寫
`extensions.gen_random_bytes()` 並先 `create extension if not exists pgcrypto`，
否則在乾淨的新專案上會失敗。

**2026-09-20 實地演練**：開了一個全新 Supabase 專案從頭跑完 migration + 部署 8 支
edge function + 建後台帳號 + 登入 + 權限測試，全部通過（詳見 `supabase/README.md`），
測完已刪除。演練抓到兩個真問題：(1) `current_user_role()` 參照 bni-report 的
`user_roles`，新分會一呼叫就炸，已用 `to_regclass` 擋掉；(2) 新專案的內建寄信有
額度限制、且 `.local` 網域會被拒——**長展舊制的 `<手機>@changzhan.local` 帳號格式
在新專案建不起來**，第一個後台帳號要用 Dashboard 的 Add user + Auto Confirm。

⚠️ **以後改 DB 結構，請同時更新 `supabase/migrations/`**，否則又會回到
「只有正式環境知道真相」的狀態。

---

## 六之二、分會專屬設定（`chapterConfig.ts`）

分會名稱、站台網址、LINE OA／LIFF ID 集中在 `chapterConfig.ts`，每個值都能用
`VITE_` 環境變數覆蓋，沒設就用長展目前的值當 fallback。要開新分會時改 `.env`
就好，不必翻每個頁面。**已驗證**：只設一個 `VITE_CHAPTER_SHORT_NAME=測試`，
build 後整站的頁首、頁尾、大事記、報到頁都跟著改名。

⚠️ **這裡有個會咬人的坑（實測踩到）**：Vite 只保證替換**字面上的**
`import.meta.env.VITE_XXX`。寫成 `import.meta.env[key]` 這種動態索引時，
值會不會被 inline 取決於壓縮器——實測 build 出來的頁面**整個讀不到環境變數**，
安靜地用 fallback。

`supabaseClient.ts` 原本就是這個寫法，意思是 `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` 在正式站其實沒有生效，一直用的是寫死的長展專案。
長展自己沒事（fallback 就是它自己），但**開第二家分會時會安靜地接到長展的資料庫**。
已改成靜態存取。日後新增環境變數請一律寫 `import.meta.env.VITE_XXX`。

`chapterConfig.ts` 管不到的地方，開新分會時要手動改：`index.html` 的 title 與
og 預設值、`metadata.json`、`constants.tsx` 的範例資料、`api/activity-og.ts`
（Vercel function 吃 `process.env`，已改成讀 `CHAPTER_NAME` / `SITE_HOST`）、
以及 `supabase/functions/*` 裡的 `SITE_URL` 與 `LIFF_SIGNUP_ID` 常數。

---

## 七、開發指令

```bash
npm install
npm run dev        # 本機 http://localhost:3001（純 vite dev server）
npm run typecheck  # tsc --noEmit，只檢查型別不產檔
npm run build      # 先 tsc --noEmit，通過才 vite build 產出 dist/
npm run preview    # 本機預覽 build
```

⚠️ **build 會先跑型別檢查**：`vite build` 本身不做型別檢查，過去因此漏掉過「元件必填 prop 沒傳」這種會在執行期炸掉的錯。現在 `build` 前置 `tsc --noEmit`，型別不過就不會產檔。`tsconfig.json` 已加 `vite/client` 型別（`import.meta.env`）並排除 `server.ts`。

部署：push 到 `main` 分支 → Vercel 自動部署。

---

## 八、已知狀況 / 待辦

### 安全

2026-09-20 做過一輪收緊，Supabase advisor 的 **ERROR 已清空**，剩下的都是 WARN：

**已處理：**
- ✅ `attendance` 已啟用 RLS（先前是 advisor ERROR）
- ✅ **`activity-images` storage 政策**：原本是 public 角色無條件可寫可刪，等於任何人拿前端的 anon key 就能上傳或刪除活動圖片與會員照片。改為「公開讀、`authenticated` + `is_changzhan_editor()` 才能寫」。實測 anon 上傳被擋（RLS 403）、anon 刪除刪不到東西，公開讀取正常。
- ✅ **`guest_attendance_summary` 改為 `security_invoker`**：原本是 SECURITY DEFINER 而 anon 有 SELECT 權限，等於繞過 RLS 把來賓姓名電話公開出去。改完 anon 讀它回傳空陣列。
- ✅ `check_message_recently_sent` / `handle_new_user` / `sync_role_to_jwt` 撤掉對外的 EXECUTE。**注意**：Postgres 預設把 EXECUTE 給 `PUBLIC`，只撤 anon/authenticated 沒有用，要連 PUBLIC 一起撤。

**仍待處理：**
- 🟡 `message_send_log` 允許 anon insert/update — LIFF 訪客報到的歡迎訊息以 anon 身分呼叫 `send-line-message`，該函式要寫紀錄。要收緊得先改成由 edge function 以 service role 寫入。
- 🟡 `line_groups` 有一條 anon 的 `FOR ALL` 政策 — 唯讀帳號仍可繞過前端直接改群組資料。要收緊得先確認 `line-webhook` 用哪個 key 寫入。
- 🟡 `list_unbound_members()` 對 anon 開放（LIFF 會員綁定的下拉選單需要），等於未綁定會員的姓名可被列舉。
- 🟡 `public_member_cards()` 對 anon 開放電話 + email，可被逐 id 爬取。
- 🟡 Supabase Auth 「Leaked Password Protection」未啟用（5 秒 toggle，只有你能開）

其餘 15 支 SECURITY DEFINER 函式的 advisor WARN 是**預期中的**：RLS 政策本身要呼叫 `is_changzhan_admin()` 這類函式，撤掉 EXECUTE 會讓後台整個讀不到資料；LIFF 與公開報名的函式則必須對 anon 開放。安全靠的是函式內部的檢查（token、有效期、手機末 4 碼）。

### 文件 / 結構
- `App.tsx` 28KB / `constants.tsx` 36KB — 規模不小，未來可考慮模組化
- `pages/admin/` 子目錄需補充細節到本文件

---

## 九、常見開發模式

### 修改頁面
1. 找對應 `pages/<Page>.tsx`
2. 跨頁共用的常數放 `constants.tsx`
3. `npm run dev` 本機驗證
4. commit + push → Vercel 自動部署

### 新增 Supabase 操作
1. 確認 RLS 政策（前端用 anon 或 authenticated 角色）
2. 動到 LIFF / 訪客流程的話要記得 anon 角色的權限
3. 不確定的話查 `current_user_role()` 與 RLS policy 配合

### LINE LIFF 流程
- 設定 LIFF ID 在 LINE Developers Console
- 從 LINE 開啟連結 → 進入 LIFF SDK 處理 → 拿到 `liff.getProfile()` 的 user_id
- 後續呼叫 `line_checkin()` 或 `guest_bind_and_checkin()` SECURITY DEFINER function

### LINE 長展小幫手（OA bot 推播）
共用同一個 LINE Channel（與 `send-line-message` 用的 Channel Access Token 相同）。

**Edge Functions（原始碼已全部收進 `supabase/functions/`，見 `supabase/README.md`）：**

| Function | verify_jwt | 用途 |
|----------|-----------|------|
| `send-line-message` | ✅ | 1 對 1 推播給會員 / 來賓（既有） |
| `line-webhook` | ❌ | LINE 平台 webhook 接收端，HMAC 驗簽，自動 upsert `line_groups` |
| `line-broadcast` | ✅ | admin/editor 觸發，多群組同時推播文字 + 圖片 |
| `line-notify-registration` | ✅ | 報名後自動推到 `app_settings.line_notify_registration_group_id` 指定的群組 |

**所需 Supabase Edge Function Secrets：**
- `LINE_CHANNEL_ACCESS_TOKEN`（已存在）
- `LINE_CHANNEL_SECRET`（webhook 驗簽用，**新增**）
- `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_ANON_KEY`（Supabase 自動注入）

**LINE Developers Console 設定：**
- Webhook URL：`https://qxoglhkfxxqsjefynzqn.supabase.co/functions/v1/line-webhook`
- Use webhook：ON
- Allow bot to join group chats：ON
- 把 bot 加到群組後，bot 收到 `join` 事件就會自動進 `line_groups` 表

**Admin 介面：** `/admin/line-groups`（由 `pages/admin/LineGroupManager.tsx` 提供），
側欄與頁面標題叫「**通知設定**」——這頁現在同時管 Telegram 報名通知與 LINE 小幫手，
再叫「LINE 小幫手」名實不符。**路由維持 `/admin/line-groups`**（只是換名字，不值得動路由）。
內容：Telegram 報名通知、LINE 群組清單、自動回覆公告、發送紀錄、本月額度

⚠️ **後台的手動推播已停用**（避免誤觸消耗 LINE 額度）：
- 「群發公告」UI 與 `handleSend` 已移除，`components/LineMessageTester.tsx` 已刪除
- `line-broadcast` edge function **仍部署著**（只是沒有介面呼叫它），且已加上「呼叫者必須是可編輯的後台人員」檢查
- 要恢復請看 git 歷史（commit 訊息含「群發」）

**仍會自動送出、會消耗額度的路徑**（不是誤觸，但要知道）：
- **訪客報到歡迎訊息**：LIFF 報到成功後推給該位訪客本人（`LiffCheckin.tsx` → `send-line-message`）。
  這則必須留在 LINE——收件者是來賓本人。
- 自動回覆公告（`!公告`）走 LINE 的 reply API，**不計入推播額度**。
- ~~報名通知~~ 已於 2026-09-24 改送 Telegram，見下一節。

### 報名通知改送 Telegram（`telegram-notify`）

有人報名 → 通知幹部。原本推到 LINE 群組，但**這種訊息不值得用掉 LINE 的推播額度**，
而 Telegram Bot API 沒有則數限制，所以搬過去。

- **觸發點不變**：`App.tsx::handleRegister`（公開報名）與 `handleAddRegistration`（代為報名）
  fire-and-forget invoke `telegram-notify`，失敗不影響報名本身。
- **只收 `{ registrationId }`**：收件對象與內容一律由伺服器用 service role 從 DB 組，
  呼叫端無法指定，所以不會被拿去當免費發送管道（與 `send-registration-email` 同一個原則）。
  訊息比 LINE 版多一行「這場目前共 N 人報名」。
- **`action: 'probe'`** 列出 bot 看得到的聊天室與 chat id、**`action: 'test'`** 發測試訊息，
  兩者都**要求呼叫者是 `admins` 表裡的人**（實測未登入呼叫回 401）。
  一般的報名通知不能要求登入——公開報名流程是 anon。
- **設定**：secret `TELEGRAM_BOT_TOKEN`（Supabase Dashboard → Edge Functions → Secrets），
  聊天室存在 `app_settings.telegram_notify_chat_id`，後台 `/admin/line-groups` 最上面那塊可改，
  附「找出我的 chat id」與「發測試訊息」兩顆按鈕。
- **沒設定就安靜跳過**並在 `notification_log` 記一筆 `skipped`（報名已經成功，
  不該因為通知沒設定而讓使用者看到錯誤）。發送結果一律寫 `notification_log`，
  避免「沒送出也沒人知道」。
- **`line-notify-registration` 仍部署著但已無人呼叫**，後台那塊 LINE 設定標成「已停用」並保留值，
  要改回 LINE 只要把 `App.tsx` 兩處 invoke 的名字換回去。

⚠️ **設定時一定會踩到的坑：bot 的隱私模式預設是開的**，所以 bot **看不到群組裡的一般訊息**，
`getUpdates` 回空的、「找出我的 chat id」找不到任何聊天室。兩種解法：
- 最快：在群組裡傳一則 `/start@<bot名稱>`——指名給 bot 的指令，隱私模式開著也收得到
- 或在 BotFather 傳 `/setprivacy` → 選該 bot → Disable，**然後把 bot 退出群組再重新加入**
  （設定只對之後加入的群組生效）

probe 找不到聊天室時會自己查 `getMe` 與 `getWebhookInfo`，依實際狀態回具體指示
（webhook 攔走 / 不能加入群組 / 隱私模式 / 都正常但沒收到訊息），不用瞎猜。

**驗證狀況**：未設定 token 時報名通知回 `{ok:true, skipped:"no_bot_token"}` 並寫入紀錄；
probe/test 未登入呼叫回 401；**2026-09-24 實際送出成功**，`notification_log` 有 `sent` 紀錄。

**報名通知流程：** `App.tsx::handleRegister` insert 完 `registrations` 後 fire-and-forget invoke `line-notify-registration`，失敗不影響使用者報名動作。

### 報名確認信（Resend）

原本用 EmailJS，2026/09 改為 **Resend**。

**為什麼一定要搬到伺服器端：** EmailJS 的 public key 設計上就是給瀏覽器用的（原本三組 ID 直接寫死在 `pages/ActivityDetail.tsx`，而這個 repo 是 public）。Resend 的 API key 是「可以用你的帳號寄任何信」的完整權限金鑰，**放進前端 bundle 等於公開**，所以改走 edge function。

**Edge function `send-registration-email`**（`verify_jwt: true`，原始碼在 `supabase/functions/send-registration-email/index.ts`——**這支有進 repo**，不像其他幾支只部署在 Supabase）：

- **只收 `{ registrationId }`**：收件地址與信件內容一律由伺服器用 service role 從 DB 撈。呼叫端無法指定收件人或內容，所以這支端點不會被拿去當免費的發信管道。
- **每次都寫 `email_send_log`**（sent / failed / skipped），避免「沒寄出也沒人知道」。
- **寄信失敗回 HTTP 200 + `ok:false`**：報名已經寫進 DB 了，寄信失敗不該讓使用者看到報名失敗。
- **沒有 email、或 `RESEND_API_KEY` 未設定 → 記一筆 `skipped` 就結束**（代為報名允許 email 留空）。
- 信裡的日期自己拆字串再用本地時間建構來算星期，`activities.date` 是純日期字串，`new Date('2026-09-15')` 會差一天。
- 顯示的費用取 `activities.price`（一般價）；會員價要登入才判斷得出來，公開報名這裡不猜。

**觸發點：** `App.tsx::handleRegister` 拿到 `newId` 後 fire-and-forget，與 `line-notify-registration` 並排。**後台「代為報名」不寄信**（`handleAddRegistration` 沒接），因為那多半是幹部補登、來賓也常沒有 email。

**所需 Supabase Edge Function Secrets：**
- `RESEND_API_KEY` — Resend 後台建立
- `RESEND_FROM` — 例如 `BNI 長展分會 <noreply@你的網域>`

⚠️ **Resend 要驗證寄件網域**。本站目前只有 `changzhan.vercel.app`（Vercel 子網域，無法加 DNS 記錄），所以**沒有可驗證的自有網域**。未設 `RESEND_FROM` 時退回 `onboarding@resend.dev`，那組**只能寄給 Resend 帳號本人**，一般報名者收不到。要真的對外寄信，得先有一個自有網域並在 Resend 完成 DNS 驗證。

### 會員電子名片（LINE Flex Message 分享）

讓會員 / 夥伴在 **LINE App 內**把會員名片直接分享給好友或群組，**不經後台、不吃 OA 推播額度**（走 `liff.shareTargetPicker`，訊息由使用者本人送出）。

**組成：**
- `lib/memberCard.ts` — flex builder：`buildMemberCardMessage`（單張 bubble）、
  `buildMemberCarouselMessage`（單則 carousel，上限 12）、`buildMemberShareMessages`（拆多則）。
  版型：大頭照 + 產業別/姓名/職稱·公司/簡介 + 底部按鈕（撥打電話 `tel:` / 看官網 `uri` /
  寫信給我 `mailto:`，只顯示有資料的）＋**「分享這張名片」**。
- **「分享這張名片」**（2026-09-25 新增）：收到名片的人可以直接往外轉傳。按鈕帶到
  `https://liff.line.me/<VITE_LIFF_CARD_ID>?member=<id>`，就是既有的 LIFF 名片頁
  （預覽 + `shareTargetPicker`），所以訊息是轉傳的人自己送出的，**不吃 OA 推播額度**。
  carousel 裡每張各自帶自己的連結。
- ⚠️ **LINE 的 10 KB 限制**（踩到才發現）：flex 訊息**每則 JSON 上限 10 KB**，不只是
  「carousel 最多 12 張」。原本 `buildMemberShareMessages` 只按 12 張切、沒看大小——
  **實測真實會員資料 9 張就 9.3 KB**，12 張必超過而被 LINE 拒收。現在改成邊塞邊量
  （預算 9000 bytes，留 1KB 緩衝），實際大約 8 張一則。
  **已驗證**：用 56 位真實會員資料測 1/9/20/60 位，每則都在上限內（8284〜8451 bytes）。
  代價是一次能分享的人數從名目上的 60 位降到約 40 位（5 則 × 8 張），放不下的會提示分批。
- `pages/LiffCard.tsx` — LIFF 頁，**雙模式**：
  - 帶參數（`?member=<id>` 或 `?ids=1,2,3`）→ 呼叫 `public_member_cards` → 預覽 → `shareTargetPicker`。
  - **無參數**（`/liff/card`）→ **多選挑選頁**：讀 `public_member_directory` 顯示可搜尋 / 產業鏈篩選的清單，勾選後抓 `public_member_cards` 組多則訊息一次分享。此無參數網址即 **OA 圖文選單**的入口。
- `pages/MemberList.tsx` — 每位會員一顆「分享電子名片」按鈕（`?member=<id>`）＋頁首一顆「多選會員·一次分享」按鈕（無參數 → 挑選頁）。deep link 皆為 `https://liff.line.me/<VITE_LIFF_CARD_ID>[?member=<id>]`。
- `members.email` 欄位（新增）+ 後台 `MemberManager.tsx` Email 輸入欄；沒填 email 的會員，名片自動不顯示「寫信給我」。

**需要的設定（只有你能做）：**
- **環境變數 `VITE_LIFF_CARD_ID`**（`.env.local` 與 Vercel 都要加，Vercel 改動後需重新 deploy 才生效，因為是 `VITE_` build-time 變數）：專用 LIFF app 的 ID。目前值 `2009854899-hb4y0DiX`，建於「長展分會」LINE Login channel。
- **LIFF app 設定**：Endpoint URL = `https://changzhan.vercel.app/liff/card`、Size = Full、Scope 勾 `profile`、Add friend option = On (normal)。
- **⚠️ shareTargetPicker 啟用（關鍵、易漏）**：不在單一 LIFF app 的 Options 頁（那裡只有 Scan QR / Module mode），而是在 **LIFF 分頁清單層級**點 `shareTargetPicker` → 同意「Agreement Regarding Use of Information」→ Enable。這是 **channel 層級**一次性同意，開一次全 channel 的 LIFF 都能用。未啟用時 `shareTargetPicker()` 會丟 `shareTargetPicker is not allowed in this LIFF app`。
- iOS LINE 內建瀏覽器的 `liff.isApiAvailable('shareTargetPicker')` 有時誤報 false，故 `LiffCard.tsx` 以 `isInClient() || isApiAvailable()` 判斷按鈕可用，實際能否用交給 `shareTargetPicker()` 的 try/catch。
- `mailto:` 「寫信給我」按鈕實測可用（LINE 接受）；若日後某情境被拒，改成 email 文字列即可（builder 內單點可調）。

**判斷路由：** `App.tsx` 最前面的 LIFF 短路判斷**先判名片**（path `/liff/card` 或 `member`/`ids` 參數，含 `liff.state` 包裹），再判例會報到，避免參數被吃掉。

### 圖片上傳自動壓縮（`lib/compressImage.ts`）

所有圖片上傳（活動封面、大事記、會員照片、LINE 公告圖）都經過 `App.tsx::handleUploadImage`，上傳前先在瀏覽器端處理：

- **長邊縮到 1600px**，輸出 **JPEG 品質 0.82**。實測 4032×3024 的手機照片從數 MB 降到數百 KB 以內。
- **有透明背景的 PNG 才保留 PNG**（例如 logo），其餘 PNG 一律轉 JPEG（透明區塊先鋪白底，否則會變黑）。
- **不用 WebP**：會員照片會進 LINE Flex Message、活動封面會當 og:image，這兩處對 WebP 支援不可靠。
- **不處理**：GIF（動圖會變靜態）、SVG、以及尺寸不用縮且小於 200 KB 的圖（避免 JPEG 二次壓縮變糊）。
- **壓完反而變大就用原檔**；**任何一步失敗都退回原檔上傳**（例如非 Safari 瀏覽器解不開 HEIC）——壓縮只是省空間，不能讓上傳失敗。
- 用 `createImageBitmap(..., { imageOrientation: 'from-image' })` 解碼，手機直拍照片依 EXIF 轉正。

文件管理（`chapter-documents`）的上傳走另一條路，**不會被壓縮**。已經上傳的舊圖不會回頭處理。

### 文件管理的 Storage 權限（踩過的雷）

`chapter-documents` bucket 原本的 storage 政策**只開給 `anon`**。後台登入改用 Supabase Auth 之後，上傳請求變成以 `authenticated` 身分送出，沒有對應政策 → 上傳一律被擋，錯誤訊息是 `new row violates row-level security policy`。

⚠️ **改動後台登入方式時，storage 政策也要一起看**，不是只有資料表的 RLS。`activity-images` 沒事是因為它的政策用的是 public 角色（涵蓋所有身分）。

現在 `chapter-documents` 的政策：
- SELECT → `authenticated` + `is_changzhan_admin()`（`createSignedUrl` 需要）
- INSERT / UPDATE / DELETE → `authenticated` + `is_changzhan_editor()`
- **anon 的寫入與刪除已移除**：anon key 寫在前端 bundle 裡是公開的，原本等於任何人都能上傳或刪除分會文件
- bucket 仍是 public，所以既有文件的公開網址照常下載，不受這些政策影響

### 後台的「可編輯 / 僅檢視」

`admins.can_edit`（boolean，預設 true）。**角色決定「看得到哪些頁」，`can_edit` 決定「能不能改」**，兩者互相獨立——所以會有「僅檢視的總管理員」這種組合。

**三層都要擋，缺一不可：**

1. **RLS（真正的防線）**：12 張後台表的政策已從 `FOR ALL` 拆成
   - SELECT → `is_changzhan_admin()`（在 admins 表裡就能讀）
   - INSERT / UPDATE / DELETE → `is_changzhan_editor()`（還要 `can_edit`）

   只在前端藏按鈕等於沒鎖，因為 anon key 是公開的、任何人都能直接打 REST API。
2. **前端攔截**：`App.tsx` 的 `g()` 把 26 個寫入型 handler 包起來，唯讀時跳提示而不是讓使用者看到 RLS 的英文錯誤。直接寫 DB 的頁面（GuestManager／PaymentManager／PaymentBatchDetail／LineGroupManager）各自收 `canEdit` prop。
3. **Edge Functions**：`manage-admin` 與 `line-broadcast` 都會查 `admins.can_edit`。service role 會繞過 RLS，所以函式必須自己檢查。

**⚠️ 已知仍未覆蓋的路徑**（動到相關功能時要留意）：
- `line_groups` 有一條 `anon` 的 `FOR ALL` 政策，唯讀帳號仍可繞過前端直接改群組資料。要收緊得先確認 `line-webhook` 是用哪個 key 寫入。
- `send-line-message` 不檢查呼叫者，**且不能檢查**——LIFF 訪客報到的歡迎訊息是以 anon 身分呼叫它的。

### 同一場活動的兩份名單（`activity_attendees` view）

同一場活動的人可能從**兩條路**進來：公開頁的報名表（`registrations`）或 LINE 接龍
（`signup_entries`）。原本兩邊互看不到——報到管理只看得到網頁報名、接龍名單只看得到接龍，
人數會少算。**實際踩到**：LTRT 那場有 4 位從網頁報名（而且都是會員），接龍卻是 0 筆。

**做法是顯示層合併，不動寫入路徑**：`activity_attendees` view（`security_invoker`）
把兩張表 union 起來，各自仍寫回原本的表。合併寫入風險太高——重複、雙寫不同步。

- **報到管理**列出兩種來源，接龍的標「接龍」badge、顯示同行人數；
  **接龍報名的人也能在這裡勾報到**（`signup_entries.checked_in`）。
  同一支電話在兩邊都出現會標「可能重複」，但**不自動刪**，由人判斷。
- **接龍名單頁**下方列出「這場活動另外有 N 人從網頁報名」，總人頭卡片也會加註合計。
  ⚠️ **「轉成收款」只會轉接龍的人**——網頁報名的收費走報到管理的繳費金額欄，
  兩邊都轉會重複收款。
- **接龍的繳費在報到管理不給改**（顯示「收款管理」），刪除也只能在接龍名單頁做，
  避免同一筆資料有兩個地方能動。
- **LIFF 接龍頁也看得到網頁報名的人**：`public_signup_sheet` 多回 `web_count` / `web_entries`
  （**只有姓名，不含電話**，與既有的 entries 一致），畫面上獨立一區「從網頁報名」，
  並註明不用重複幫他們 +1。否則會員打開接龍只看到空名單，以為沒人參加。
  ⚠️ **head_count 仍只算接龍的人**——它同時是 `public_signup_join` 判斷人數上限的基準，
  把網頁報名的人算進去等於改變上限行為（可能突然擋下正要報名的人），那要另外決定。
  ⚠️ **拿到接龍連結的人就看得到這些名字**（可能包含來賓）。接龍本來就會顯示參加者姓名，
  所以行為一致；若要更保守，可以只顯示人數不顯示名字。

**公開頁的「已有 N 人報名」原本永遠是 0**：anon 對 `registrations` 只有 INSERT 權限，
前端卻用 props 算。改用 `public_activity_headcount(activity_id)` RPC（SECURITY DEFINER，
只回一個數字），並把接龍人頭算進去。**已驗證**：未登入開 `/activity/34` 顯示「已有 4 人報名」。

### 接龍報名（`/admin/signups` + `/liff/signup`）

貼一個連結到 LINE 群組，成員點開一鍵 +1，名單即時顯示。**不花 LINE 推播額度**。

**兩張表**：`signup_sheets`（接龍）→ `signup_entries`（每筆報名）。

- **連結用隨機 `token` 不用流水號 id**：不然把網址數字加一就能看到別人的接龍。token 預設值用 URL-safe base64（`translate(..., '+/', '-_')`）——原本用一般 base64，`+` 在 query string 會被解成空白導致 token 對不上。
- **anon 完全沒有這兩張表的 RLS 權限**，LIFF 頁一律走上面那四支 SECURITY DEFINER function。
- **參加者**：會員（LIFF 自動對 `members.line_user_id`）、非會員（必填姓名電話，公司引薦人選填）、會員代帶的眷屬（`extra_count` + `extra_names`）。每張接龍可個別設定是否開放非會員、是否可帶人。
- **人數上限以「總人頭」計**（含眷屬），修改自己的報名時會先扣掉自己原本佔的位子再判斷。
- **費用分兩級**：`fee` 是一般價（0 = 免費），`member_fee` 是會員價（null = 不分級，大家同價）。
  - **算法**：本人依身分計價，**同行者一律算一般價**。例如會員價 1000 / 一般價 1300、帶 1 位 → 2300。
  - LIFF 頁只顯示「你適用的價」，底下小字列出完整價目；帶人時即時算出總額與拆解。
  - **後台名單頁直接看得到應收**：統計卡有「應收金額」與拆解，每一列也顯示該筆應收（本人價 + 同行 × 一般價）。
- **名單可切換排序**：報名順序（預設）／依組別。組別取自 `members.group_name`，來賓與沒組別的歸「未分組」排最後；組名用 `localeCompare(..., { numeric: true })` 比較，所以是 1→2→10→20→三尊 而不是字典序。依組別時每組前面插一條小標（組名 + 人數 + 該組應收小計），方便組長代收。**`#` 一律是接龍順序**，換排序不會跟著跳號。
  - 轉成收款時照身分逐筆給價，確認視窗會顯示「會員 N 位 × X／一般 M 位 × Y／合計」。
  - 接龍沒設金額（`fee = 0` 且無會員價）時，轉收款才會跳出來問金額。
- **綁定活動時會把活動資訊帶過來**：選了活動就自動填入該活動的 `price` / `member_price`（一般價與會員價）與日期時間（截止時間），主題空白時也帶入活動標題。**`fee` 與 `activities.price` 是兩個獨立欄位**，刻意不鎖死（接龍可能只收餐費），但兩者不一致時表單會跳黃色提醒，並明說「報名頁顯示的是接龍這裡的金額」。公開頁的日期／時間／地點一律取自綁定的活動，說明欄不需要重打。
- **建立後可編輯**：主題／說明／綁定活動／費用／人數上限／截止／是否可帶人／是否開放非會員都能改，**`token` 不變**，已貼出去的連結照樣有效，已報名的人不受影響。建立與編輯共用 `SheetFormModal`。
- **後台代報**的 `line_user_id` 是 null，不受「一個 LINE 帳號一筆」的 unique index 限制。
- **轉成收款**：本人一筆，帶的每一位也各一筆（有填同行者姓名就用名字，沒填記成「○○○ 的同行者 N」），這樣收款筆數跟實際人頭對得起來。

**同一張接龍可以貼到多個群組**，共用同一份名單：靠 `line_user_id` 認人，同一人從哪個群點進來都是同一筆，不會重複報名。但要知道各群的人**彼此看得到名單**、**人數上限是全域的**，而且名單上**看不出誰從哪個群報的**——需要分開統計就開不同張接龍。

**LINE 指令 `!名單` 也會算進網頁報名**（2026-09-25 修）：原本只算接龍，所以 LTRT 那場
明明有 6 人從網頁報名，bot 卻回「目前 0 人／還沒有人報名」。現在人數含兩邊，
接龍名單之後另列一段「📝 從網頁報名（N）」並註明不用重複 +1；接龍為空時文案改成
「接龍還沒有人，可直接 +1」。**已用真實資料在本機重現整段回覆驗證過**
（只有網頁 6 人 → 目前 6 人；再加 2 筆接龍含 1 位同行 → 目前 9 人，兩份名單並排）。

**LINE 指令 `!名單`**：走 reply API 不計額度。**接龍不綁群組**，所以同時有多張進行中時無法推斷該回哪一張——
- 只有一張進行中 → **依組別**列出完整名單（組名 + 該組人頭 + 名字，同一組用「、」串起來，比一人一行省版面），並顯示雙價（有會員價就兩級都列）
- **日期與地點取自綁定的活動**（自由主題的接龍沒有這兩行）。`activities.date` 是純日期字串，`new Date('2026-09-15')` 會被當 UTC 而差一天，所以自己拆字串再用本地時間建構來算星期
- 多張 → 列出清單（標題／人數／截止／各自的報名連結）讓使用者自己點

組別取自 `members.group_name`，來賓與沒組別的歸「未分組」排最後，排序規則與後台名單一致（numeric 比較）。

截止時間在程式裡篩，不用 PostgREST 的 `or()` 帶 ISO 時間字串（解析容易出意外）。

**環境變數 `VITE_LIFF_SIGNUP_ID`**（`.env.local` 與 Vercel 都要，Vercel 改完需重新 deploy）：目前值 `2009854899-KEtH0Qad`，Endpoint 應設為 `https://changzhan.vercel.app/liff/signup`。webhook 裡也寫了同一組 ID（`line-webhook` 的 `LIFF_SIGNUP_ID` 常數），**換 LIFF app 時兩邊都要改**。

**判斷路由**：`App.tsx` 最前面的 LIFF 短路判斷**先判接龍**（path `/liff/signup` 或有 `sheet` 參數，含 `liff.state` 包裹），再判名片、例會報到。

### 會員的紅綠燈（`member_traffic_lights` view）

會員資料與執事會的續約名單會帶出**最新的 PALMS 紅綠燈**：燈號（B/G/Y/R）、總分、
出席率、來賓數、一對一、引薦進出、成交金額。

⚠️ **這是跨系統讀取**：`traffic_light_imports` 是 **bni-report 獨佔**的表，由那邊上傳
報表時寫入，changzhan 只讀不寫（該表的 RLS 是 `auth_read_tl → true`，登入者可讀）。
**bni-report 改了 JSON 欄位名稱的話，這個 view 會安靜地少掉欄位**（值變 null 而不是報錯），
要記得一起改。新分會不跑 bni-report 的話，這張表不存在，相關 migration 可整個跳過。

**姓名怎麼對**（看 119 筆歸納出來的）：本名 → `members.name`；舊名／別名 →
`member_aliases`；還有「張國興(嘉元)」「陳孝慈（陳欣囍）」這種本名加括號註記的寫法，
**括號有半形也有全形**，所以括號內外都拆出來各試一次。
**對照結果：116 位在籍會員對到 114 位**，剩下 2 位（魏志宇、嚴心鏞）是報表期間之後才入會的。

**⚠️ 燈號是「過去半年」的累計，沒有更新的版本可用。** bni-report 有週報／月報
（`palms_imports`，`period_type` = weekly / monthly，週報到 2026-09-15），
但**那些資料裡沒有 `light` 與 `totalScore` 欄位**——只有出席／一對一／引薦／成交的原始數字。
燈號是 BNI 用半年累計算出來的，只存在於 `traffic_light_imports`。所以畫面上一律標明期間，
不要讓人以為是當週狀態。

- **會員管理**多一欄「燈號（半年）」，頁首顯示報表期間，滑過去可看出席率／來賓／
  一對一／引薦的明細。
- **執事會的 363 續約**「燈號」與「來賓」兩欄自動帶入同一份半年報表；
  **手動填過的以人填的為準**（`renewal_notes` 有值就不覆蓋），段落抬頭也標出期間。
- ⚠️ **續約的「來賓」欄原本算錯**：本來用 `registrations.referrer` 數網頁報名的引薦人，
  但那欄幾乎沒人填，**實測 PALMS 有 21 位來賓的人這裡算成 1**。已改成取 PALMS 的數字，
  沒有 PALMS 資料時才退回自己算。

**⚠️ 一個值得知道的發現**：拿 9/22 簡報上的 26 個燈號跟系統核對，17 個一致、9 個不同。
追下去發現那 9 個對應的是**上一期報表**（1–6 月那份 7/7 全中），也就是簡報上的燈號是從
舊報表複製來的、沒跟著更新。系統一律用最新一份（目前是 3–8 月）。

### 會員的分會職務（`members.positions`）

`text[]`，**可複選**。有效值集中在 `constants.tsx` 的 `CHAPTER_POSITIONS`：
主席／副主席／秘財／導師／執事／小組長／活動組長／培訓組長／廣宣組長／資訊組長／接待組長。
陣列順序＝顯示順序，`sortPositions()` 會依它排。

- **與 `company_title` 不同**：那是公司職稱，這是分會職務。
- **DB 端不限制名稱**（沒有 enum / check），分會改職稱時不用動 schema。代價是
  **改名字時既有資料存的是舊字串**，要自己更新；`sortPositions` 會把清單外的值排到最後，
  Excel 匯入則會擋下不在清單中的職務並說明可用值。
- **「小組長」是唯一有實際權限的職務**：含它的人可以在 LINE 自助發起組聚。
  原本的 `is_group_leader` 布林欄位已移除（2026-09-23），避免兩個來源不一致。
- 會員管理的搜尋、CSV 匯出、Excel 匯入範本都含「職務」欄（匯入時用「、」逗號或空白分隔，
  留白不會清掉既有職務）。
- **目前只在後台顯示**，公開的會員名錄（`public_member_directory`）沒有回傳職務。
  要公開的話得改那支 RPC。

### 小組長自助發起組聚（`/liff/signup?host=1`）

`pages/LiffHost.tsx` + edge function `leader-activity`。小組長在 LINE 裡點開就能發起組聚並開接龍，**不用登入後台**。

- **誰能用**：`members.positions` 含「小組長」的在籍會員，由幹部在「會員管理」編輯會員時勾選職務（列表組別旁會顯示職務 badge）。每組可以不只一位。權限只看職務這一個來源——`leader-activity` 回傳的 `is_group_leader` 是它依職務算出來的，前端不自己比對字串。
- **能做什麼**：活動類型**固定為「組聚」**，組別**自動帶入**他的 `group_name` 不能改。填主題（留白就用「第 N 組組聚」）、日期時間、地點、一般價／會員價、人數上限、說明。送出後**同時建立活動 + 綁定的接龍**（截止時間預設為活動開始時間），直接進分享畫面用 `shareTargetPicker` 貼到群組。
- **直接公開**，不需審核。幹部在後台活動管理看得到，卡片上標「第 N 組小組長從 LINE 發起」，照樣可以修改或下架。
- **只能改、取消自己發起的**（比對 `activities.created_by_member_id`）。取消是把活動與接龍都改成 `closed`，**不刪除**——已報名的名單留著給幹部查。
- **入口網址**：`https://liff.line.me/<VITE_LIFF_SIGNUP_ID>?host=1`，建議放進 OA 圖文選單。共用接龍的 LIFF app，所以 `App.tsx` 的 LIFF 短路判斷**要把 `host=1` 排在接龍之前**，否則會被 `/liff/signup` 的路徑條件接走。

**⚠️ 為什麼要走 edge function 驗 ID token，不能像接龍頁一樣直接呼叫 RPC**：接龍頁是直接相信前端傳上來的 LINE user ID，這對「報名 +1」沒什麼風險；但「建立公開活動」不一樣——只要知道某位小組長的 LINE ID 就能冒名發活動。所以前端帶 `liff.getIDToken()`，`leader-activity` 向 LINE 的 `/oauth2/v2.1/verify` 驗證後才以 service role 寫入。實測偽造的 token 會回 401。

**需要的設定（只有你能做）**：
- **接龍的 LIFF app 要勾 `openid` scope**（LINE Developers → LIFF → 該 app → Scopes）。沒勾的話 `getIDToken()` 會是 null，頁面會直接顯示這個錯誤訊息。
- `leader-activity` 的 secret `LINE_LOGIN_CHANNEL_ID`（選填）：LIFF app 所屬 LINE Login channel 的 ID。沒設就用長展的 `2009854899`（LIFF ID 的格式是 `<channel id>-<亂碼>`，前半段就是它）。**開新分會時一定要設**。

**驗證狀況**：欄位檢查的純函式 9 個案例全過；偽造／缺少 token 會被擋（401）；用 SQL 模擬函式寫入的資料，確認官網看得到、接龍頁帶得出活動資訊與雙價、取消後接龍擋下新報名且保留既有名單。**沒辦法實測的**：真的從 LINE 登入拿 ID token 走完 create/update/cancel——需要一位小組長在手機上實際操作一次。

### 執事會（`/admin/meetings`）

`pages/admin/MeetingManager.tsx`。例會後的執事會：**簽到 + 會議記錄 + 待辦追蹤**。

- **會議本身是一筆 `activities`**（`type = '執事會'`），所以 QR 報到（`CheckinQrPanel` →
  `line_checkin()`）與 `attendance` 出席統計都是現成的，不用重寫一套。
- **應到名單**＝職務在 `constants.tsx` 的 `LEADERSHIP_MEETING_POSITIONS`
  （主席／副主席／秘財／導師／執事）裡的在籍會員。**各組長與小組長不在此列。**
- 簽到只記 **出席／請假／缺席**，不套用例會那套 07:01 遲到規則（`line_checkin` 本來就
  只對「例會活動」判遲到）。
- **會議記錄照固定議程 8 段**（依分會既有簡報）：出缺席報告／今日來賓訪談/入會申請追蹤／
  上週來賓／之前來賓／363 續約／流程優化＆建議／臨時動議。存 `meeting_minutes`（一場一份）。
  **能自動算的就不手填**：

  | 議程 | 資料來源 |
  |---|---|
  | 1 出缺席報告 | 對應例會的 `attendance`，自動算 P/A/L/M/S 與名單、來賓數 |
  | 2/4/5 來賓追蹤 | `guest_follow_ups` 依 `visit_date` 自動分成今日／上週／之前 |
  | 3 入會申請 | `guest_follow_ups` 裡 `state = 'applied'` 的 |
  | 6 363 續約 | `members` 未來三個月到期者；狀況／燈號／組別委員存 `renewal_notes` |
  | 7/8 | 純文字 |

  **P 出席的算法**＝點名的出席＋遲到＋代理（人到了就算到）。**已用 9/22 實際資料核對過**：
  系統算出 116 人 / P 114 / 缺席張文昱 / 遲到 9 位 / 醫療黃偉傑 / 代理 8 位，
  **與分會簡報上的數字與名單完全一致**。
- **來賓追蹤是同一份資料跨週延續**：現在的做法是每週在簡報裡把人從「今日」搬到「上週」
  再搬到「之前」，改成一位來賓一筆紀錄、依來訪日期自動分組。狀態有
  追蹤中／已填單／已入會／不追蹤。
  ⚠️ **來賓多半不在系統裡**（9/22 有 8 位來賓，`registrations` 只有 1 筆），所以這份清單
  主要靠手動建；但建一次之後就會自己往後推。
- **產出**：「複製全文」貼 LINE 群組，或**「匯出簡報」產生 .pptx 直接投影**
  （`lib/meetingReport.ts`，pptxgenjs 在瀏覽器端產生，dynamic import 所以只有按下去才會
  載入那 370KB 的 chunk）。續約與來賓表格會自動分頁（續約每頁 8 列，與原簡報一致）。
  ⚠️ 匯出的是**相同結構的新版型，不是原檔的像素級複製**——要複製原版型得在伺服器端
  拿 .pptx 當範本改 XML，瀏覽器做不到。
- **待辦追蹤**（`meeting_action_items`）：內容、負責人（會員選單，也可留空）、期限、完成勾選。
  逾期會標紅。**其他場次未完成的待辦會自動列在下方**，開會時直接對上次的進度。
- 刪掉會議時，記錄與待辦會一起刪（`on delete cascade`，實測確認）。

**⚠️ 內部活動（`activities.is_internal`）**：執事會不該出現在官網與行事曆。
這靠兩層：

1. **DB trigger `activities_force_internal`**：只要 `type = '執事會'` 就強制
   `is_internal = true`，不管是從哪條路徑寫入的。只靠前端記得帶旗標，哪天漏掉
   就是把開會時間地點公開出去。
2. **RLS**：`activities_public_read` 改成 `using (coalesce(is_internal, false) = false)`，
   **未登入者根本讀不到**內部活動。實測 anon 直接查該筆、列出活動、甚至 `activity_og`
   view 都是空的。

後台人員登入後拿到的是完整清單，所以 `App.tsx` 另外算一份 `publicActivities`
（濾掉 `is_internal`）傳給首頁／例會／培訓／組聚／行事曆／活動詳情這幾個公開頁。

**驗證狀況**：trigger 與 RLS 實測過（未登入者四種讀法都拿不到）；用 SQL 模擬頁面的
寫入與 cascade 刪除，行為正確；公開頁在瀏覽器確認活動照常顯示、沒有執事會；
出缺席自動計算與 9/22 簡報逐項核對一致；匯出的 .pptx 用真實資料產過一份，
10 張投影片、結構與欄寬都在範圍內。
匯出的簡報版面**已由使用者實際開檔確認過（2026-09-24）**——這台機器沒有 PowerPoint
也沒有 LibreOffice，渲染不出來，所以版面一律得人工看過。
**後台畫面需登入，我沒有實際點過。**

### 收支月報表（`/admin/finance` → 月報表分頁）

`pages/admin/FinanceMonthlyReport.tsx`。收支管理分成「流水帳／月報表」兩個分頁。

版面照你們帳冊的骨架：**上月結轉 → 本月收入 → 本月支出 → 月底結餘**，底下是收入／支出的分類佔比與當月明細，可匯出 CSV。

**⚠️ 結轉只能用一種方式表達，兩種同時用會重複計算：**
1. **目前採用**：把「上月結轉」當成一筆收入輸入在流水帳（`id=122`，2026-04-01，343,016）。此時「期初餘額」設定要維持 **0**。
2. 另一種：流水帳只放實際收支，結存填在報表上的「期初餘額」（存 `app_settings.finance_opening_balance`）。

**已驗證**：用做法 1 算出來的逐月結餘與帳冊完全一致——4月底 338,381、5月底 358,234、6月底 393,669、7月底 396,435，分別等於 Excel 上 5/6/7/8 月的「結轉」。

日期一律用 `YYYY-MM-DD` 字串比對月份，不進 Date 物件（避免被當 UTC 而差一天）。

### 應付帳款（`/admin/payables`）

`pages/admin/PayableManager.tsx`。記錄**即將發生但還沒付**的支出——你們 Excel 右側那塊「應付帳款明細表」就是這個（匯入 4-8 月收支時刻意跳過沒收，因為那是預估負債不是實際收支）。

⚠️ **名稱**：需求上寫的是「應收帳款」，但描述的是即將發生的支出，會計上叫**應付**帳款。用這個名字也才不會跟「收款管理」（跟會員收錢）混淆。

**流程**：建立 → 確認支付 → 產生 `finance_records` 一筆 `expense`，並用 `finance_record_id` 連回來。**沒確認支付前不會進流水帳**，所以收支管理裡永遠只有真正發生的錢。

- **確認支付時可改日期與金額**：預估 5,200 實付 5,000 很常見，金額不同時會提示，並把應付紀錄一併更新為實付金額（以免帳上留著錯的預估）。
- **撤銷支付**會把流水帳那筆一併刪除再改回待支付，否則帳上會留下不該存在的支出。
- **金額允許負數**：沖銷／退回（你們表上的「獎金兌換 -2000」）。
- **逾期**＝`status='pending'` 且 `due_date` 早於今天（台北時間），列表整列標紅並在統計卡單獨計算。
- 寫入順序是**先寫流水帳拿到 id、再回頭標記已付**，避免標成已付卻沒有帳。
- `finance_record_id` 是 `on delete set null`：若有人直接從收支管理刪掉那筆支出，應付紀錄會**維持已支付但失去關聯**（不會自動改回待支付）。要改狀態請用「撤銷支付」。

### 收款管理（`/admin/payments`）

`pages/admin/PaymentManager.tsx`（項目列表）+ `PaymentBatchDetail.tsx`（單一項目的收款明細）。

**兩層結構**：`payment_batches`（收款項目）→ `payment_items`（每人一筆）。每月餐費只是「每個月開一個項目」，活動收費就是另開項目、名單與金額自訂。

**明細為什麼要存姓名快照**：收款對象包含來賓，而來賓身分在系統裡是散的——只有 2 位在 `guests` 表，46 位只存在於 `registrations`，家屬則完全不在任何名單。所以 `payee_name`/`payee_phone` 一定會存，`member_id`/`guest_id`/`registration_id` 三個關聯欄位「有的話才連」，且用 check constraint 限制最多只能設一個。

**資料庫層的防呆**（都實測過會擋下）：
- `payment_items` 三組 partial unique index → 同一項目不會重複收同一位會員／來賓
- `payment_items_single_ref` check → 不會同時指向會員又指向來賓
- `payment_items_method_valid` check → 方式只能是 `cash`/`linepay`/`transfer`
- `payment_batches_period_uniq` → 同一個月份只會有一個餐費項目，「建立本月餐費」可安全重複按

**費用可分兩級**：`default_amount` 是一般價，`member_amount` 是會員價（null = 不分級，每月餐費就是這種）。規則與接龍一致——**會員本人算會員價，來賓與名單外的人算一般價**。建立項目與「加入名單」時都會依身分逐筆給 `amount_due`，之後仍可個別調整。選了「關聯活動」會自動帶入該活動的 `price` / `member_price`。

**繳費狀態不存欄位**，由 `amount_paid` 對 `amount_due` 推導（0＝未繳、不足＝部分、足額＝已繳），避免改了金額狀態沒跟著對。

**名單來源**（建立項目時可混用，之後也能用「加入名單」追加）：全體在籍會員 / 依組別 / 搜尋手動勾選（會員＋來賓）/ 從某場活動的出席名單帶入（會員取自 `attendance`、來賓取自已報到的 `registrations`）/ 直接打名字（家屬這類不在任何名單的人）。

**寫入收支**：一個項目對應 `finance_records` 一筆，靠 `payment_batch_id` 識別，重複寫入是**更新金額**而不是新增。刪除收款項目時明細會連動刪除，但收支那筆會保留（`on delete set null`）——帳不會憑空消失。

**未做**：LINE 催繳、CSV 匯出、線上金流（LINE Pay 只記錄方式，不串接）。

### 公開活動行事曆（`/calendar`）

`pages/Calendar.tsx`，導覽列「行事曆」。月曆格狀，只顯示**活動**。

> 曾一併顯示會員生日（`public_member_birthdays()` RPC，只回月／日），後來決定取消，前端與該 RPC 都已移除。若日後要加回來，記得生日對 anon 是額外的個資揭露，優先考慮只給登入者看。

- **活動**由 `App.tsx` 既有的公開 activities state 傳入（只顯示 `status = 'active'`），依 `type` 上色，圖例只列出當月出現的類型。點日期看當天詳情，點活動卡進 `/activity/:id` 報名。
- **時區**：`activities.date` 是純日期字串，`new Date('2026-08-20')` 會被當 UTC 而在台北時間差一天。頁面用 `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' })` 取今天、其餘一律以 `YYYY-MM-DD` 字串比對，不進 Date 物件。
- 手機版格子放不下活動名稱，改以顏色圓點表示，點下去看下方詳情。

### 代為報名（`/admin/check-in`）

有來賓（尤其年長者）不方便線上報名時，幹部可在「報到管理 (訪客)」按右上角「**代為報名**」直接建資料，不必替對方去填公開表單。

- 表單欄位＝公開報名表的欄位＋繳費金額／已報到／備註。Email 可留空（DB 為 NOT NULL，`App.tsx::handleAddRegistration` 會補 `''`）。
- 同一活動出現相同電話會先跳確認，避免重複登記。
- 「發送 LINE 報名通知到群組」預設勾選，行為與來賓自行報名一致（invoke `line-notify-registration`）；**補登舊資料時記得取消**。
- 走 `supabase.from('registrations').insert()`（authenticated，RLS `is_changzhan_admin()`），不經公開的 `public_create_registration` RPC。

### 來賓管理（`/admin/guests`）

`pages/admin/GuestManager.tsx`。清單是**兩種來源的聯合**：`guest_attendance_summary`（`guests` 表，早期有綁 LINE 的來賓）＋ `registrations` 中 `guest_id is null` 的報名（實務上佔絕大多數）。列的識別是 `(kind, id)`。

- **不做 LINE 訊息發送**：單發 / 群發 / 勾選收件人 / 訊息發送紀錄都已移除。要推播請用「LINE 長展小幫手」(`/admin/line-groups`)。
- **來賓不再做 LINE 綁定**：頁面上的「已綁 / 未綁 LINE」統計卡、狀態欄與篩選鈕都已移除，統計改為 總來賓 / 曾出席 / 已備註。`guests.line_user_id` 與 LIFF 的 `guest_bind_and_checkin()` 流程**尚未拆除**（既有 2 筆綁定資料仍在），若確定要停用需另外處理 `pages/LiffCheckin.tsx` 的訪客分支。
- **備註欄**：`guests.notes` 與 `registrations.notes` 兩張表都有此欄，前端依列的 `kind` 寫回對應表（因此同一人若有多筆未綁報名，備註是各自獨立的）。`guest_attendance_summary` view 已加上 `g.notes`。備註也納入搜尋範圍。
- 兩張表的 RLS 皆為 `is_changzhan_admin()`（比對 JWT email 與 `admins.email`），所以備註只有後台登入者能改。

### 後台人員權限管理（Email + 密碼）

`/admin/users`（`pages/admin/UserManager.tsx`）。列表欄位：姓名 / 登入信箱 / 權限角色 / 操作（編輯・刪除）。

- **帳號 = Email**，新增時同步在 Supabase Auth 建帳號（`email_confirm: true`，不寄驗證信）。
- **編輯**可改姓名 / Email / 權限角色，密碼欄留白＝不變更、填了就是重設密碼（至少 6 碼）。改 Email 會同步改 Auth 帳號的 email。
- 既有人員的 email 是舊制手機衍生的 `<手機>@changzhan.local`，列表會標「舊帳號 · 建議改真實信箱」；用編輯功能換成真信箱即可，換完舊手機登入方式對該人員失效。
- **⚠️ 共用 Auth 的陷阱**：changzhan 與 bni-report 共用同一組 Supabase Auth，`auth.users` 裡本來就有 bni-report 的真實信箱帳號（`mr.ogenki@gmail.com`、`yvonne10805@gmail.com`）。把人員信箱改成這種既存帳號時，GoTrue 會拒絕重複註冊。函式因此回 409 `email_has_account`，前端跳確認後帶 `adopt: true` 重送：**沿用既有 Auth 帳號**當登入帳號（同步 name/role 到 user_metadata、有填才改密碼），`admins.email` 指過去，再刪掉舊的手機衍生帳號。等於此人在兩系統共用同一組帳密。
- 全部經 Edge Function **`manage-admin`**（`verify_jwt: true`，service role），action：`create` / `update` / `delete`，可帶 `adopt: true`。呼叫者必須是 `admins` 表中 `role = '總管理員'`，與 UI 的 `canAccessUsers` 一致。repo 內無此 function 原始碼（部署於 Supabase）。
- 前端一律走 `App.tsx::invokeManageAdmin`：`functions.invoke` 在 non-2xx 時只給 `FunctionsHttpError`，真正訊息在 `error.context`（Response）裡，要自己 `.json()` 撈出來，否則畫面只會顯示「Edge Function returned a non-2xx status code」。
- 登入的 Auth 帳號若不在 `admins` 表（例：只有 bni-report 權限的人），`/admin` 會顯示「此帳號沒有後台權限」+ 登出按鈕（由 `profileResolved` 區分「還在載入」與「查無此人」）。

---

## 九之一、業務規則（出席判定）

### 例會遲到規則（07:01）

**規則：** 「例會活動」報到時間以**台北當地時間 07:01** 為界，**07:01（含）之後**報到記為「遲到（late）」，07:01 以前（即 07:00:59 含以前）記為「出席（present）」。

- **僅限例會**：只有 `activities.type = '例會活動'`（`ActivityType.REGULAR_MEETING`）才套用，因為例會時間固定。其他活動類型（一般活動、商務培訓等）一律記「出席」，不看時間。
- **作用點**：實作在 Supabase `line_checkin()` SECURITY DEFINER function 內（LINE LIFF 掃碼自動報到的會員主流程）。判斷式：
  ```sql
  IF v_activity.type = '例會活動'
     AND (NOW() AT TIME ZONE 'Asia/Taipei')::time >= TIME '07:01' THEN
    v_status := 'late';
  ELSE
    v_status := 'present';
  END IF;
  ```
- **邊界**：`>= 07:01`，所以 07:00:59 仍算「出席」，07:01:00 起算「遲到」。
- **時區**：DB 存 UTC，比較時用 `AT TIME ZONE 'Asia/Taipei'` 換算。
- **重複掃碼**：同一會員再掃會依當下時間重新判定並更新 `updated_at`。
- **不影響後台手動操作**：`pages/admin/AttendanceManager.tsx` 的五顆狀態按鈕（出席/遲到/代理/病假/缺席）仍是幹部手動覆寫，**不會**被此規則自動改寫。
- **門檻寫死 07:01**：如未來需各活動可調遲到門檻，再改為讀 `app_settings` 或 `activities` 欄位。

---

## 十、與其他專案

- **bni-report**：共用 Supabase project，`user_roles` + `current_user_role()` 共用
- 其他（食在力量、mogenki-dispatch、wagyu-game）：完全獨立，無交集
