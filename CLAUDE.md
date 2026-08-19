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
| Email | @emailjs/browser | EmailJS |
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
| `activities` | 活動資料（id, title, date, time, location, picture 等）。另有 `activity_og` view 供 OG function 用，見第四節 |
| `admins` | 後台管理員（`name`/`email`/`role`；`email` 即登入帳號。`phone`、`password` 為舊欄位，已不再使用）|
| `registrations` | 活動報名記錄（含 `notes` 備註，供來賓管理裡尚未綁定 LINE 的列使用）|
| `members` | 會員資料 |
| `attendance` | 出席記錄（⚠️ 目前 **RLS 未啟用**，需修） |
| `guests` | 訪客資料（含 `notes` 備註）|
| `finance_records` | 財務記錄 |
| `milestones` | 大事記 |
| `app_settings` | 系統設定（key/value，例：`line_notify_registration_group_id`） |
| `message_send_log` | LINE 訊息發送記錄（`recipient_kind`: member / guest / **group**） |
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
| `public_member_cards(p_ids bigint[])` | 電子名片：回傳指定會員的名片欄位（含 `mobile_phone`/`email`，僅 active，依傳入順序）。供 `LiffCard.tsx`（anon）取單/多位會員資料。⚠️ 對 anon 開放電話+email，屬可被逐 id 爬取的個資，若要收緊可改為需登入或加頻率限制 |

⚠️ Supabase advisor 對這些都有 `anon_security_definer_function_executable` warning，但部分函式**必須對 anon 開放**（如 LIFF 簽到流程的訪客）。動權限前要先確認流程不會壞。

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
- 🔴 **`attendance` 表 RLS 未啟用**（advisor ERROR）— 任何人可直接修改出席記錄
- 🟡 多張表是 `allow_all` 政策（activities、admins、documents、finance_records、members、milestones、registrations、**line_groups、app_settings(UPDATE/INSERT)**）— 需逐一 audit + 收緊。後台登入已改走 Supabase Auth（Email + 密碼），後續可依 `authenticated` 角色逐表收緊，不必再維持 `allow_all`。
- 🟡 `guest_attendance_summary` view 是 SECURITY DEFINER（advisor ERROR）— 應改為 SECURITY INVOKER 或 revoke
- 🟡 `message_send_log` 允許 anon insert/update — 需評估是否真的需要（`guests`、`registrations` 已改為 `is_changzhan_admin()`，`registrations` 僅保留 anon insert 給公開報名）
- 🟡 Storage buckets `activity-images`、`chapter-documents` 允許公開列檔 — 改為僅按 URL 存取
- 🟡 Supabase Auth 「Leaked Password Protection」未啟用（5 秒 toggle）

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

**Edge Functions（皆部署於 Supabase，repo 內無原始檔）：**

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

**Admin 介面：** `/admin/line-groups`（由 `pages/admin/LineGroupManager.tsx` 提供）— 群組清單、報名通知群組設定、群發公告（多選 + 全選 + 文字 + 圖片）、發送紀錄

**報名通知流程：** `App.tsx::handleRegister` insert 完 `registrations` 後 fire-and-forget invoke `line-notify-registration`，失敗不影響使用者報名動作。

### 會員電子名片（LINE Flex Message 分享）

讓會員 / 夥伴在 **LINE App 內**把會員名片直接分享給好友或群組，**不經後台、不吃 OA 推播額度**（走 `liff.shareTargetPicker`，訊息由使用者本人送出）。

**組成：**
- `lib/memberCard.ts` — flex builder：`buildMemberCardMessage`（單張 bubble）、`buildMemberCarouselMessage`（單則 carousel，上限 12）、`buildMemberShareMessages`（拆多則：每則 carousel 12、最多 5 則＝60 位）。版型：大頭照 + 產業別/姓名/職稱·公司/簡介 + 底部按鈕（撥打電話 `tel:` / 看官網 `uri` / 寫信給我 `mailto:`，只顯示有資料的）。
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
