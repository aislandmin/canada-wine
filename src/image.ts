/**
 * Shrink a photo in the browser before upload: max 1600px on the long side.
 * Keeps transparency (WebP/PNG) for cut-out bottle photos; otherwise JPEG.
 * Phone photos are often 5–10 MB; this typically brings them under 500 KB.
 */
export async function prepareImage(file: File, maxSide = 1600): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('只支持 JPG、PNG、WebP 格式的图片');

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('无法读取该图片');
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1_500_000) {
    bitmap.close();
    return file; // already small enough
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const hasAlpha = file.type !== 'image/jpeg';
  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));

  if (hasAlpha) {
    const webp = await toBlob('image/webp');
    if (webp && webp.type === 'image/webp') return webp; // Safari can't encode WebP; falls through
    const png = await toBlob('image/png');
    if (png) return png;
  }
  const jpeg = await toBlob('image/jpeg');
  if (!jpeg) throw new Error('图片处理失败');
  return jpeg;
}
