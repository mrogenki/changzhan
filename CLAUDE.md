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
| SSR | Express + Vite middleware（`server.ts`，僅用於動態 OG tags） | Vercel Functions |
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
| `CoffeeMeeting.tsx` | 咖啡會議頁面 |
| `BusinessTraining.tsx` | 商務培訓頁面 |
| `Milestones.tsx` | 大事記 |
| `MemberList.tsx` | 會員列表 |
| `LiffCheckin.tsx` | LINE LIFF 內嵌簽到頁 |
| `LoginPage.tsx` | 後台登入 |
| `AdminDashboard.tsx` | 後台主頁 |
| `admin/` | 後台子頁面（待補充細節） |

### 元件（`components/`）

- `ActivityListView.tsx` — 活動列表
- `CheckinQrPanel.tsx` — 簽到 QR Code 顯示
- `LineFloatingButton.tsx` — LINE 浮動按鈕
- `LineMessageTester.tsx` — LINE 訊息測試工具

---

## 四、`server.ts` — 為什麼有 Express？

主要原因：**動態 OG tags**。

當有人把 `/activity/:id` 的連結貼到 LINE / Facebook，社群預覽（OG tag）需要顯示該活動的標題、描述、圖片。React SPA 預設只能用 static tags，所以這支 server.ts 在 SSR 階段：

1. 從 Supabase 抓 activity 資料
2. 替換 `index.html` 內的 `__OG_TITLE__`、`__OG_DESCRIPTION__`、`__OG_IMAGE__`、`__OG_URL__` placeholder
3. 再吐 HTML

其餘流量則由 Vite middleware 處理（dev mode）或 static `dist/` 處理（production）。

---

## 五、Supabase 資料表

### 本系統使用的（12 張）

| Table | 說明 |
|-------|------|
| `activities` | 活動資料（id, title, date, time, location, picture 等） |
| `admins` | 後台管理員 |
| `registrations` | 活動報名記錄 |
| `members` | 會員資料 |
| `attendance` | 出席記錄（⚠️ 目前 **RLS 未啟用**，需修） |
| `guests` | 訪客資料 |
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

⚠️ Supabase advisor 對這些都有 `anon_security_definer_function_executable` warning，但部分函式**必須對 anon 開放**（如 LIFF 簽到流程的訪客）。動權限前要先確認流程不會壞。

---

## 七、開發指令

```bash
npm install
npm run dev      # 本機 http://localhost:3000（用 server.ts，含 OG tags）
npm run build    # 產出 dist/
npm run preview  # 本機預覽 build
```

部署：push 到 `main` 分支 → Vercel 自動部署。

---

## 八、已知狀況 / 待辦

### 安全
- 🔴 **`attendance` 表 RLS 未啟用**（advisor ERROR）— 任何人可直接修改出席記錄
- 🟡 多張表是 `allow_all` 政策（activities、admins、documents、finance_records、members、milestones、registrations、**line_groups、app_settings(UPDATE/INSERT)**）— 需逐一 audit + 收緊。根因是後台登入是純前端 state（比對 `admins` 表密碼後 setState），沒走 Supabase Auth；所有 admin 寫操作都是 anon。等系統遷到 Supabase Auth 後可一次收緊所有 admin 表 RLS。
- 🟡 `guest_attendance_summary` view 是 SECURITY DEFINER（advisor ERROR）— 應改為 SECURITY INVOKER 或 revoke
- 🟡 `guests` 與 `message_send_log` 允許 anon insert/update — 需評估是否真的需要
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
