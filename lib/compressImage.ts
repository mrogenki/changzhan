// 上傳前在瀏覽器端把圖片縮小再壓縮。
//
// 手機拍的照片動輒 3–5 MB、4000px 以上，但網站上最大也只顯示到 1000 多 px，
// 原檔直接上傳只是在浪費 Storage 空間和訪客的流量。
//
// 輸出一律用 JPEG（有透明背景的 PNG 才保留 PNG），不用 WebP：
// 會員照片會放進 LINE Flex Message，活動封面會當 og:image，
// 這兩個地方對 WebP 的支援都不可靠。
//
// 任何一步失敗（例如非 Safari 瀏覽器解不開 HEIC）都回傳原檔，
// 壓縮只是省空間，不能因此讓上傳失敗。

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

// 動圖、向量圖、本來就很小的圖不處理
const SKIP_TYPES = new Set(['image/gif', 'image/svg+xml']);
const SKIP_BELOW_BYTES = 200 * 1024;

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  // createImageBitmap 會照 EXIF 方向轉正，手機直拍的照片才不會躺著
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* 舊瀏覽器不支援 options，退回 <img> 解碼 */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const { data } = ctx.getImageData(0, 0, w, h);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || SKIP_TYPES.has(file.type)) return file;

  try {
    const src = await decode(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(src.width, src.height));

    // 尺寸不用縮、檔案也不大 → 不動，避免 JPEG 再壓一次反而變糊
    if (scale === 1 && file.size < SKIP_BELOW_BYTES) return file;

    const w = Math.round(src.width * scale);
    const h = Math.round(src.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    if ('close' in src && typeof (src as ImageBitmap).close === 'function') (src as ImageBitmap).close();

    const keepPng = file.type === 'image/png' && hasTransparency(ctx, w, h);
    const outType = keepPng ? 'image/png' : 'image/jpeg';

    if (!keepPng) {
      // JPEG 沒有透明度，透明區塊會變黑；先鋪白底再畫一次
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
    }

    const blob = await toBlob(canvas, outType, keepPng ? undefined : JPEG_QUALITY);
    // 壓完反而變大（少數已經高度壓縮過的圖）就用原檔
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${base}.${keepPng ? 'png' : 'jpg'}`, {
      type: outType,
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn('圖片壓縮失敗，改用原檔上傳:', err);
    return file;
  }
}
