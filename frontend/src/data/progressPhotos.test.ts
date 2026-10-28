import { describe, expect, it } from 'vitest';
import { exifDate, groupBy, weekOf } from './progressPhotos';

/** A minimal JPEG: SOI, then APP1 Exif with IFD0 -> ExifIFD -> DateTimeOriginal. */
function jpegWithDate(date: string, le = true): ArrayBuffer {
  const tiff: number[] = [];
  const u16 = (n: number) => (le ? [n & 255, n >> 8] : [n >> 8, n & 255]);
  const u32 = (n: number) => (le ? [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24] : [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255]);
  tiff.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
  // IFD0 at 8: one entry 0x8769 -> Exif IFD at 26
  tiff.push(...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0));
  // Exif IFD at 26: one entry 0x9003 ASCII count 20 at offset 44
  tiff.push(...u16(1), ...u16(0x9003), ...u16(2), ...u32(20), ...u32(44), ...u32(0));
  const s = date + '\0';
  for (const c of s) tiff.push(c.charCodeAt(0));
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const bytes = [0xff, 0xd8, 0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 255, ...app1, 0xff, 0xd9];
  return new Uint8Array(bytes).buffer;
}

describe('progress photos', () => {
  it('reads the camera date (both byte orders)', () => {
    expect(exifDate(jpegWithDate('2026:09:14 10:22:01'))).toBe('2026-09-14');
    expect(exifDate(jpegWithDate('2025:01:02 08:00:00', false))).toBe('2025-01-02');
    expect(exifDate(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeNull();
  });
  it('groups by week', () => {
    expect(weekOf('2026-10-18')).toBe('2026-10-12');
    expect(groupBy([{ d: 'a' }, { d: 'b' }, { d: 'a' }], (r) => r.d).map(([k, v]) => [k, v.length])).toEqual([['a', 2], ['b', 1]]);
  });
});
