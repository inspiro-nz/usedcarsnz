/**
 * Client-side image compression for listing-photo upload (§ perf / bandwidth).
 *
 * Runs entirely in the BROWSER — no upload path renders these yet (photo upload
 * is a separate work package), but this is the ready-to-wire encoder a file
 * <input> hands each selected image to before it ever hits the network:
 *
 *   - downscale so the long edge is <= 1600px (keeps aspect ratio),
 *   - encode WebP at ~0.8 quality,
 *   - step quality down until the blob is <= ~200KB (or a floor is hit).
 *
 * No dependencies: uses createImageBitmap + canvas, both Workers/browser-native.
 * The pure geometry/decision helpers below are unit-tested; the canvas encode
 * path needs a real browser and is exercised in E2E, not vitest (jsdom has no
 * canvas). Import only from client components.
 */

export interface CompressOptions {
  /** Longest edge, in px, after downscale. */
  maxLongEdge?: number;
  /** Target max output size, in bytes. */
  targetBytes?: number;
  /** Starting WebP quality (0..1). */
  quality?: number;
  /** Lowest quality to drop to before giving up on targetBytes. */
  minQuality?: number;
}

export const DEFAULTS = {
  maxLongEdge: 1600,
  targetBytes: 200 * 1024,
  quality: 0.8,
  minQuality: 0.5,
} as const satisfies Required<CompressOptions>;

/**
 * Scale (w, h) so the long edge is at most maxLongEdge, preserving aspect ratio.
 * Never upscales. Rounds to whole pixels. PURE — unit-tested.
 */
export function fitWithinLongEdge(
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxLongEdge || longest === 0) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxLongEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Next quality to try when a blob is still over target: proportional to how far
 * over we are, clamped to a single downward step and to minQuality. PURE.
 */
export function nextQuality(
  currentQuality: number,
  currentBytes: number,
  targetBytes: number,
  minQuality: number,
): number {
  if (currentBytes <= targetBytes) return currentQuality;
  const ratio = targetBytes / currentBytes; // < 1
  const proposed = currentQuality * Math.max(0.6, ratio);
  return Math.max(minQuality, Number(proposed.toFixed(3)));
}

export interface CompressResult {
  blob: Blob;
  width: number;
  height: number;
  quality: number;
  bytes: number;
}

async function toBitmap(file: Blob): Promise<{ width: number; height: number; bitmap: ImageBitmap }> {
  const bitmap = await createImageBitmap(file);
  return { width: bitmap.width, height: bitmap.height, bitmap };
}

function makeCanvas(width: number, height: number): { ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D; encode: (q: number) => Promise<Blob> } {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    return { ctx, encode: (q) => canvas.convertToBlob({ type: "image/webp", quality: q }) };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  return {
    ctx,
    encode: (q) =>
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/webp", q),
      ),
  };
}

/**
 * Compress a user-selected image to a WebP Blob within the size/dimension
 * budget. Browser-only (needs createImageBitmap + canvas).
 */
export async function compressImage(file: Blob, opts: CompressOptions = {}): Promise<CompressResult> {
  const o = { ...DEFAULTS, ...opts };
  const { width, height, bitmap } = await toBitmap(file);
  const dims = fitWithinLongEdge(width, height, o.maxLongEdge);

  const { ctx, encode } = makeCanvas(dims.width, dims.height);
  ctx.drawImage(bitmap, 0, 0, dims.width, dims.height);
  if ("close" in bitmap) bitmap.close();

  let quality = o.quality;
  let blob = await encode(quality);
  // Step quality down until under target or we hit the quality floor.
  for (let i = 0; i < 5 && blob.size > o.targetBytes && quality > o.minQuality; i++) {
    const q = nextQuality(quality, blob.size, o.targetBytes, o.minQuality);
    if (q === quality) break;
    quality = q;
    blob = await encode(quality);
  }

  return { blob, width: dims.width, height: dims.height, quality, bytes: blob.size };
}
