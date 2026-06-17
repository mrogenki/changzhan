# BNI 長展分會官方網站

BNI 長展分會的對外活動報名 + LINE 簽到 + 後台管理系統。

> 詳細專案說明請見 [`CLAUDE.md`](CLAUDE.md)。

## 技術架構

- **Frontend**: Vite + React + TailwindCSS 4
- **Backend**: Supabase（與 `bni-report` 共用同一個 Supabase project）
- **整合**: LINE LIFF（活動簽到）、EmailJS（通知）
- **SSR**: Express server（`server.ts`，主要為 OG tags 動態渲染）
- **部署**: Vercel

## 本機開發

```bash
npm install
cp .env.example .env.local      # 填入實際值，從 Vercel Dashboard 取得
npm run dev                      # http://localhost:3001
```

## 環境變數

複製 `.env.example` 為 `.env.local` 後填入：

- `VITE_SUPABASE_URL` — Supabase 專案 URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key
- `GEMINI_API_KEY` — Google Gemini API key（如有用到 AI 功能）

## 部署

push 到 `main` 分支 → Vercel 自動部署。
環境變數請在 Vercel Dashboard → Settings → Environment Variables 設定。
