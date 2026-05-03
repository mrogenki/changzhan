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

**本系統（changzhan）獨佔**：`activities`、`admins`、`registrations`、`members`、`attendance`、`finance_records`、`milestones`、`guests`、`app_settings`、`message_send_log`、`documents`

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

### 本系統使用的（11 張）

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
| `app_settings` | 系統設定 |
| `message_send_log` | LINE 訊息發送記錄 |
| `documents` | 文件管理 |

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
- 🟡 多張表是 `allow_all` 政策（activities、admins、documents、finance_records、members、milestones、registrations）— 需逐一 audit + 收緊
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

---

## 十、與其他專案

- **bni-report**：共用 Supabase project，`user_roles` + `current_user_role()` 共用
- 其他（食在力量、mogenki-dispatch、wagyu-game）：完全獨立，無交集
