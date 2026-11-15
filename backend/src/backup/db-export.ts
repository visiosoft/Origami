import { deflateRawSync } from 'zlib';

/**
 * The weekly database copy (Batch 6): every table as JSON, in one .zip, with
 * secrets left out. Pure (no database, no Drive), so it can be tested.
 */

/** Columns that hold passwords, sign-in secrets or tokens: never copied. */
export const SECRET_COLUMN = /^(passwordHash|inviteToken|backupCodes|trustedDevices|calendarRefreshToken|mailRefreshToken|totpSecret|totpPending|otpHash|otpPending)$/;
/** Settings keys that are secrets, besides the ones settings already masks. */
const SECRET_SETTING = /secret|token|password|apikey|api_key|privatekey/i;

/** A row with its secret columns removed. */
export function scrubRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (!SECRET_COLUMN.test(k)) out[k] = v;
  return out;
}

/** app_settings rows minus any secret value. */
export function scrubSettings(rows: { key: string; value: string | null }[], secretKeys: string[]) {
  return rows.filter((r) => !secretKeys.includes(r.key) && !SECRET_SETTING.test(r.key));
}

// ------------------------------------------------------------------ a small .zip writer (deflate)

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Zip these files (deflated). Enough for tens of MB of JSON; no zip64. */
export function zipFiles(files: { name: string; data: Buffer }[], when = new Date()): Buffer {
  const dosTime = ((when.getHours() & 31) << 11) | ((when.getMinutes() & 63) << 5) | ((when.getSeconds() / 2) & 31);
  const dosDate = (((when.getFullYear() - 1980) & 127) << 9) | (((when.getMonth() + 1) & 15) << 5) | (when.getDate() & 31);
  const locals: Buffer[] = []; const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const comp = deflateRawSync(f.data, { level: 9 });
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(f.data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12); central.writeUInt16LE(dosDate, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(f.data.length, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, comp);
    centrals.push(central, name);
    offset += local.length + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/** Which old copies to remove so only the newest `keep` remain (names sort by date). */
export function toPrune<T extends { name: string }>(files: T[], keep = 8): T[] {
  const ours = files.filter((f) => /^origami-db-\d{4}-\d{2}-\d{2}/.test(f.name)).sort((a, b) => b.name.localeCompare(a.name));
  return ours.slice(keep);
}
