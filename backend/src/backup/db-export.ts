import { deflateRawSync, inflateRawSync } from 'zlib';

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

/** Nov 19: the zip writer has no zip64 -- stop well before 4 GB rather than write a broken file. */
export const ZIP_LIMIT = 3.5 * 1024 ** 3;

/** Read back a zip made by zipFiles (stored or deflated entries). */
export function unzipFiles(zip: Buffer): { name: string; data: Buffer }[] {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || zip.length - end < 22) throw new Error('Not a zip (no end record).');
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const out: { name: string; data: Buffer }[] = [];
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(at) !== 0x02014b50) throw new Error('Damaged zip (central directory).');
    const method = zip.readUInt16LE(at + 10); const crc = zip.readUInt32LE(at + 16);
    const csize = zip.readUInt32LE(at + 20); const nlen = zip.readUInt16LE(at + 28); const xlen = zip.readUInt16LE(at + 30); const clen = zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    const name = zip.toString('utf8', at + 46, at + 46 + nlen);
    if (zip.readUInt32LE(local) !== 0x04034b50) throw new Error(`Damaged zip (${name}).`);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const raw = zip.subarray(start, start + csize);
    const data = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
    if (crc32(data) !== crc) throw new Error(`Damaged zip (${name} checksum).`);
    out.push({ name, data });
    at += 46 + nlen + xlen + clen;
  }
  return out;
}

/**
 * Nov 19: check a copy -- it opens, every table's JSON parses, and each has
 * the rows the manifest (and the live database) said.
 */
export function verifyZip(zip: Buffer, expected: { table: string; rows: number }[]): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  let files: { name: string; data: Buffer }[];
  try { files = unzipFiles(zip); } catch (e) { return { ok: false, problems: [(e as Error).message] }; }
  const byName = new Map(files.map((f) => [f.name, f.data]));
  let manifest: any = null;
  try { manifest = JSON.parse(String(byName.get('manifest.json') || '')); } catch { problems.push('manifest.json is missing or unreadable'); }
  for (const t of expected) {
    const buf = byName.get(`${t.table}.json`);
    if (!buf) { problems.push(`${t.table}: missing`); continue; }
    let rows: unknown;
    try { rows = JSON.parse(buf.toString('utf8')); } catch { problems.push(`${t.table}: not valid JSON`); continue; }
    if (!Array.isArray(rows) || rows.length !== t.rows) problems.push(`${t.table}: ${Array.isArray(rows) ? rows.length : '?'} rows, expected ${t.rows}`);
    const m = manifest?.tables?.find?.((x: any) => x.table === t.table);
    if (manifest && (!m || m.rows !== t.rows)) problems.push(`${t.table}: manifest says ${m?.rows ?? 'nothing'}`);
  }
  return { ok: !problems.length, problems: problems.slice(0, 20) };
}

/** The environment a copy comes from, from the app's address: staging, odin, … (Nov 19: staging and Prod may share one Google account). */
export function envName(baseUrl: string | null | undefined): string {
  try {
    const host = new URL(String(baseUrl || '')).hostname.toLowerCase();
    if (!host || host === 'localhost' || /^[\d.]+$/.test(host)) return 'local';
    const first = host.split('.')[0];
    return (first === 'www' || first === 'app' ? host.split('.')[1] : first).replace(/[^a-z0-9-]/g, '') || 'app';
  } catch { return 'local'; }
}

/**
 * Nov 19: uploaded files live in Google Drive, not in the database -- list
 * where each one is (File Room files, and attachments on any record), so a
 * file deleted or moved in Drive can be found again from a copy.
 */
export function filesIndex(tables: { table: string; rows: Record<string, unknown>[] }[]) {
  const out: { table: string; rowId: string; projectId?: unknown; folder?: string; name: string; driveId?: string | null; url?: string | null }[] = [];
  for (const t of tables) {
    for (const r of t.rows) {
      if (t.table === 'file_room_files' && r.driveId) {
        out.push({ table: t.table, rowId: String(r.id), projectId: r.projectId, folder: Array.isArray(r.folderPath) ? (r.folderPath as string[]).join(' / ') : undefined, name: String(r.name || ''), driveId: String(r.driveId) });
      }
      let atts = r.attachments as unknown;
      if (typeof atts === 'string') { try { atts = JSON.parse(atts); } catch { atts = null; } }
      if (Array.isArray(atts)) {
        for (const a of atts as any[]) {
          if (!a || !(a.fileId || a.driveId || a.url)) continue;
          out.push({ table: t.table, rowId: String(r.id ?? ''), projectId: r.projectId, name: String(a.name || ''), driveId: a.fileId || a.driveId || null, url: a.url || null });
        }
      }
    }
  }
  return out;
}

const DAY_RE = /^origami-db-(?:([a-z0-9-]+)-)?(\d{4}-\d{2}-\d{2})-\d{4}\.zip$/;
/** A copy's environment and day from its name (older copies have no environment). */
export function copyOf(name: string): { env: string | null; day: string } | null {
  const m = DAY_RE.exec(name);
  return m ? { env: m[1] || null, day: m[2] } : null;
}

/**
 * Nov 19: which copies to keep -- the last 14 nightly, 8 weekly (Sundays) and
 * 12 monthly (the 1st, or the first copy that month). The rest go to Drive's
 * Trash. Only this environment's copies (and older unnamed ones) are touched;
 * copies that failed their check don't count as keepers.
 */
export function toTrash<T extends { name: string; id: string }>(files: T[], env: string, bad: Set<string> = new Set(), keep = { daily: 14, weekly: 8, monthly: 12 }): T[] {
  const ours = files.map((f) => ({ f, c: copyOf(f.name) })).filter((x) => x.c && (x.c.env === env || x.c.env === null))
    .sort((a, b) => b.c!.day.localeCompare(a.c!.day) || b.f.name.localeCompare(a.f.name));
  const good = ours.filter((x) => !bad.has(x.f.id));
  const kept = new Set<string>();
  const daysSeen = new Set<string>();
  for (const x of good) { if (daysSeen.size >= keep.daily) break; if (!daysSeen.has(x.c!.day)) { daysSeen.add(x.c!.day); kept.add(x.f.id); } }
  const weeks = new Set<string>(); const months = new Set<string>();
  for (const x of good) {
    const d = new Date(x.c!.day + 'T12:00:00Z');
    if (d.getUTCDay() === 0 && weeks.size < keep.weekly && !weeks.has(x.c!.day)) { weeks.add(x.c!.day); kept.add(x.f.id); }
  }
  // Monthly: the earliest good copy of each month.
  const firstOfMonth = new Map<string, (typeof good)[number]>();
  for (const x of good) firstOfMonth.set(x.c!.day.slice(0, 7), x); // sorted newest first, so the last set is the earliest
  for (const [m, x] of [...firstOfMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]))) { if (months.size >= keep.monthly) break; months.add(m); kept.add(x.f.id); }
  // A bad copy is trashed only once a good one exists that's newer.
  const newestGood = good[0]?.c!.day || '';
  return ours.filter((x) => !kept.has(x.f.id) && !(bad.has(x.f.id) && x.c!.day >= newestGood)).map((x) => x.f);
}

/** Which old copies to remove so only the newest `keep` remain (names sort by date). */
export function toPrune<T extends { name: string }>(files: T[], keep = 8): T[] {
  const ours = files.filter((f) => /^origami-db-\d{4}-\d{2}-\d{2}/.test(f.name)).sort((a, b) => b.name.localeCompare(a.name));
  return ours.slice(keep);
}
