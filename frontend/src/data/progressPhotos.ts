/** Progress Photos: a project's photos by track and category (backend file-room/progress-photos.ts). */
export type PhotoTrack = 'construction' | 'design';
export interface ProgressPhoto {
  id: string; projectId: number; track: PhotoTrack; category: string; area: string; takenOn: string; caption: string; tags: string[];
  clientVisible: boolean; name: string; mimeType: string; uploadedBy: string; createdAt: string;
}
export interface UnsortedPhoto { id: string; name: string; mimeType?: string; uploadedBy?: string; updatedAt?: string; folderPath: string[] }
export interface PhotoCategories { construction: { name: string; cover?: boolean }[]; design: { name: string }[] }

/** Monday of the week a date falls in (yyyy-mm-dd), for grouping the timeline. */
export function weekOf(day: string): string {
  const d = new Date(day + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Group photos (already sorted) by a key, keeping order. */
export function groupBy<T>(rows: T[], key: (r: T) => string): [string, T[]][] {
  const out = new Map<string, T[]>();
  for (const r of rows) { const k = key(r); out.set(k, [...(out.get(k) || []), r]); }
  return [...out.entries()];
}

/**
 * The date a photo was taken, from its camera data (JPEG EXIF DateTimeOriginal,
 * else DateTime) -- yyyy-mm-dd, or null when the photo doesn't say.
 */
export function exifDate(buf: ArrayBuffer): string | null {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
  let off = 2;
  while (off + 4 <= v.byteLength) {
    const marker = v.getUint16(off);
    const size = v.getUint16(off + 2);
    if (marker === 0xffe1 && off + 10 <= v.byteLength && v.getUint32(off + 4) === 0x45786966) return tiffDate(v, off + 10);
    if ((marker & 0xff00) !== 0xff00 || size < 2) return null;
    off += 2 + size;
  }
  return null;
}

function tiffDate(v: DataView, start: number): string | null {
  if (start + 8 > v.byteLength) return null;
  const le = v.getUint16(start) === 0x4949;
  const u16 = (o: number) => v.getUint16(start + o, le);
  const u32 = (o: number) => v.getUint32(start + o, le);
  const ascii = (o: number, n: number) => { let s = ''; for (let i = 0; i < n && start + o + i < v.byteLength; i++) { const c = v.getUint8(start + o + i); if (!c) break; s += String.fromCharCode(c); } return s; };
  const entries = (ifd: number) => {
    const out = new Map<number, number>();
    if (ifd + 2 > v.byteLength - start) return out;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (start + e + 12 > v.byteLength) break; out.set(u16(e), e); }
    return out;
  };
  const toIso = (s: string) => { const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(s); return m && m[1] !== '0000' ? `${m[1]}-${m[2]}-${m[3]}` : null; };
  const readStr = (e: number) => { const count = u32(e + 4); return count <= 4 ? ascii(e + 8, count) : ascii(u32(e + 8), count); };
  const ifd0 = entries(u32(4));
  const exifPtr = ifd0.get(0x8769);
  if (exifPtr != null) { const exif = entries(u32(exifPtr + 8)); const dto = exif.get(0x9003); if (dto != null) { const d = toIso(readStr(dto)); if (d) return d; } }
  const dt = ifd0.get(0x0132);
  return dt != null ? toIso(readStr(dt)) : null;
}

/** The date for an uploaded photo: its camera date, else the file's own date. */
export async function photoDate(file: File): Promise<string> {
  try { const d = exifDate(await file.slice(0, 256 * 1024).arrayBuffer()); if (d) return d; } catch { /* no camera data */ }
  const m = new Date(file.lastModified || Date.now());
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
}
