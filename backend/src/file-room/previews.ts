/**
 * The two small copies made for every File Room file (Nov 5): a square
 * thumbnail for the grid and an uncropped preview for a quick look before the
 * original loads. Photos come from the original bytes; PDFs, Office files and
 * anything sharp can't read (HEIC) come from Drive's own render of page 1.
 */
import sharp = require('sharp');

export const THUMB_PX = 300;
export const PREVIEW_PX = 1200;

export const isPhotoMime = (mime?: string | null) => /^image\/(jpe?g|png|webp|gif|tiff|avif)$/i.test(String(mime || ''));

/**
 * Thumbnail: 300 x 300, cropped to fill, centred on a photo and taken from
 * the top of a document page (where the title block usually is).
 * Preview: up to 1200 px wide, never enlarged, not cropped.
 */
export async function makeVariants(source: Buffer, kind: 'photo' | 'page'): Promise<{ thumb: Buffer; preview: Buffer; width: number; height: number }> {
  const base = sharp(source, { failOn: 'none', limitInputPixels: 120_000_000 }).rotate();
  const meta = await base.metadata();
  const thumb = await base.clone()
    .resize(THUMB_PX, THUMB_PX, { fit: 'cover', position: kind === 'page' ? 'top' : 'centre' })
    .webp({ quality: 70, effort: 4 })
    .toBuffer();
  const preview = await base.clone()
    .resize({ width: PREVIEW_PX, height: PREVIEW_PX * 2, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 74, effort: 4 })
    .toBuffer();
  return { thumb, preview, width: meta.width || 0, height: meta.height || 0 };
}

/** How long to wait before trying again: Drive needs a few seconds to render a new upload's page. */
export const retryAfterMs = (tries: number) => Math.min(6 * 3600_000, 30_000 * 2 ** Math.max(0, tries - 1));
export const MAX_TRIES = 6;

/** Staging only (Azure's site host starts with "dev-"): existing files are filled in on their own there. */
export const isStagingHost = (host = process.env.WEBSITE_HOSTNAME || process.env.APP_BASE_URL || '') => /(^|\/\/)dev-/i.test(host);
