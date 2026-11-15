/**
 * Drawings kept in the browser (Nov 10 sync: big drawing sets loaded slowly
 * every time). A PDF is stored in the browser's Cache Storage the first time
 * it opens, keyed by the file and its version (size + last change), so the
 * next open is instant and works without a connection. A newer version of the
 * same file replaces the old one; the oldest drawings go when the store gets
 * past its limits.
 */
const CACHE = 'origami-drawings-v1';
const INDEX = 'origami.drawings.index';
export const MAX_ITEMS = 40;
export const MAX_BYTES = 400 * 1024 * 1024;

type Entry = { id: string; at: number; bytes: number };
type Index = Record<string, Entry>;

const urlOf = (key: string) => `/__drawings/${encodeURIComponent(key)}`;
/** The cache key: file id plus its version, or null when the version isn't known (then nothing is cached). */
export function drawingKey(id: string, v?: { size?: number | null; updatedAt?: string | null } | null): string | null {
  if (!v || (v.size == null && !v.updatedAt)) return null;
  return `${id}:${v.size ?? ''}:${v.updatedAt ?? ''}`;
}

function readIndex(): Index {
  try { return JSON.parse(localStorage.getItem(INDEX) || '{}') as Index; } catch { return {}; }
}
function writeIndex(ix: Index) {
  try { localStorage.setItem(INDEX, JSON.stringify(ix)); } catch { /* private mode */ }
}

/**
 * What to drop so the store stays within its limits: other versions of the
 * same file first, then the least recently opened. Pure, for testing.
 */
export function toEvict(ix: Index, keep: string, limits = { items: MAX_ITEMS, bytes: MAX_BYTES }): string[] {
  const keepId = ix[keep]?.id;
  const out = Object.keys(ix).filter((k) => k !== keep && ix[k].id === keepId);
  const rest = Object.entries(ix).filter(([k]) => !out.includes(k)).sort((a, b) => a[1].at - b[1].at);
  let items = rest.length;
  let bytes = rest.reduce((a, [, e]) => a + e.bytes, 0);
  for (const [k, e] of rest) {
    if (items <= limits.items && bytes <= limits.bytes) break;
    if (k === keep) continue;
    out.push(k); items--; bytes -= e.bytes;
  }
  return out;
}

const supported = () => typeof caches !== 'undefined' && typeof localStorage !== 'undefined';

export async function cachedDrawing(key: string): Promise<ArrayBuffer | null> {
  if (!supported()) return null;
  try {
    const hit = await (await caches.open(CACHE)).match(urlOf(key));
    if (!hit) return null;
    const ix = readIndex();
    if (ix[key]) { ix[key].at = Date.now(); writeIndex(ix); }
    return await hit.arrayBuffer();
  } catch { return null; }
}

export async function storeDrawing(key: string, id: string, buf: ArrayBuffer): Promise<void> {
  if (!supported() || buf.byteLength > MAX_BYTES / 2) return;
  try {
    const cache = await caches.open(CACHE);
    const ix = readIndex();
    ix[key] = { id, at: Date.now(), bytes: buf.byteLength };
    for (const k of toEvict(ix, key)) { await cache.delete(urlOf(k)); delete ix[k]; }
    await cache.put(urlOf(key), new Response(buf.slice(0), { headers: { 'Content-Type': 'application/pdf' } }));
    writeIndex(ix);
  } catch {
    // Out of space: let the older half go, keep working without the copy.
    try {
      const cache = await caches.open(CACHE);
      const ix = readIndex();
      const old = Object.entries(ix).sort((a, b) => a[1].at - b[1].at).slice(0, Math.ceil(Object.keys(ix).length / 2));
      for (const [k] of old) { await cache.delete(urlOf(k)); delete ix[k]; }
      writeIndex(ix);
    } catch { /* nothing more to do */ }
  }
}

/** The bytes from the browser when it has this version, else from `load` (and kept for next time). */
export async function withDrawingCache(id: string, version: { size?: number | null; updatedAt?: string | null } | null | undefined, load: () => Promise<ArrayBuffer>): Promise<ArrayBuffer> {
  const key = drawingKey(id, version);
  if (key) {
    const hit = await cachedDrawing(key);
    if (hit) return hit;
  }
  const buf = await load();
  if (key) void storeDrawing(key, id, buf);
  return buf;
}
