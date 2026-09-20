// 分會專屬設定
//
// 要把這套系統開給另一個分會時，**只需要改這裡 + .env**，不必翻遍每個頁面。
// 每個值都可以用 VITE_ 環境變數覆蓋；沒設定時用長展目前的值當預設，
// 所以這次重構對長展本身沒有任何行為改變。
//
// ⚠️ VITE_ 是 build-time 變數：在 Vercel 改完要重新 deploy 才會生效。
//
// 這個檔案管不到的地方（開新分會時要手動改）：
//   · index.html 的 <title> 與 og:* 預設值（靜態 HTML，SPA 載入前就要正確）
//   · metadata.json
//   · constants.tsx 裡的範例資料
//   · api/activity-og.ts（Vercel serverless function，吃的是 process.env 不是 import.meta.env）
//   · supabase/functions/* 裡的 SITE_URL 與 LIFF_SIGNUP_ID 常數

// ⚠️ 一定要用靜態的 import.meta.env.VITE_XXX 寫法。
// Vite 只保證替換「字面上的」成員存取；寫成 import.meta.env[key] 這種動態索引時，
// 值會不會被 inline 取決於壓縮器，實測會整個失效 —— build 出來的頁面照樣用
// fallback，環境變數等於白設。開新分會時這個坑會讓人把系統接到別家的資料庫上。
const pick = (v: unknown, fallback: string) =>
  (typeof v === 'string' && v.trim()) ? v.trim() : fallback;

/** 分會簡稱，用在「○○大事記」「LINE ○○小幫手」這種複合詞 */
export const CHAPTER_SHORT_NAME = pick(import.meta.env.VITE_CHAPTER_SHORT_NAME, '長展');

/** 分會名稱，最常用的那個 */
export const CHAPTER_NAME = pick(import.meta.env.VITE_CHAPTER_NAME, `${CHAPTER_SHORT_NAME}分會`);

/** 含組織前綴的全名，用在頁首、名片、報到頁這種正式場合 */
export const CHAPTER_FULL_NAME = pick(import.meta.env.VITE_CHAPTER_FULL_NAME, `BNI ${CHAPTER_NAME}`);

/** 公開報名時「沒有特定引薦人」的選項名稱 */
export const NO_REFERRER_OPTION = pick(import.meta.env.VITE_NO_REFERRER_OPTION, `BNI${CHAPTER_NAME}`);

/** 站台網址，用在分享文案與名片連結 */
export const SITE_URL = pick(import.meta.env.VITE_SITE_URL, 'https://changzhan.vercel.app').replace(/\/$/, '');

/** LINE 官方帳號 ID（給「加好友」浮動按鈕用） */
export const LINE_OA_ID = pick(import.meta.env.VITE_LINE_OA_ID, '@568cognw');

/** LIFF app ID：電子名片／接龍報名 */
export const LIFF_CARD_ID = pick(import.meta.env.VITE_LIFF_CARD_ID, '2009854899-hb4y0DiX');
export const LIFF_SIGNUP_ID = pick(import.meta.env.VITE_LIFF_SIGNUP_ID, '2009854899-KEtH0Qad');
