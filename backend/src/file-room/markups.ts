import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

/**
 * PDF markup (Oct 2026): what a markup is, who sees it, and how it's drawn into
 * a PDF. Points are page-relative (0-1) on the page as it's shown (after the
 * page's own rotation); widths and text sizes are in PDF points.
 */
export const MARKUP_KINDS = ['pen', 'highlight', 'text', 'line', 'arrow', 'rect', 'ellipse', 'cloud', 'measure_len', 'measure_area', 'scale', 'pin'] as const;
export type MarkupKind = (typeof MARKUP_KINDS)[number];
export type Pt = [number, number];

export interface MarkupData {
  points: Pt[];
  color: string;
  width: number;
  text?: string;
  size?: number;
  /** measure_len / measure_area: the value as shown ("12'-6\""); scale: the real length typed in. */
  label?: string;
  real?: number;
  unit?: 'ft' | 'm';
  /** pin: site photos pinned to the spot (File Room files). */
  photos?: PinPhoto[];
}

export interface PinPhoto { fileId: string; name: string }
export const MAX_PIN_PHOTOS = 30;

/**
 * Named layers (Oct 27 sync): a markup sits on a named layer ("Electrical
 * walk", "Owner comments"), or -- unnamed -- on its author's own layer.
 */
export function cleanLayer(v: unknown): string | null {
  // No commas: layers travel as a comma-separated list in download links.
  const s = String(v ?? '').replace(/[\s,]+/g, ' ').trim().slice(0, 60);
  return s || null;
}

/** The key a layer is shown, hidden and downloaded by. */
export const layerKey = (m: { layer?: string | null; authorId?: string | null; authorName?: string | null }) =>
  m.layer ? `L:${m.layer.toLowerCase()}` : `A:${m.authorId || m.authorName || ''}`;

export function cleanPhotos(v: unknown): PinPhoto[] {
  return (Array.isArray(v) ? v : [])
    .filter((p: any) => p && typeof p.fileId === 'string' && p.fileId)
    .slice(0, MAX_PIN_PHOTOS)
    .map((p: any) => ({ fileId: String(p.fileId).slice(0, 80), name: String(p.name || 'Photo').slice(0, 200) }));
}

const HEX = /^#[0-9a-f]{6}$/i;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const MAX_POINTS = 5000;

/** A markup as sent by the viewer, cleaned. Throws on anything unusable. */
export function cleanMarkup(raw: any): { kind: MarkupKind; page: number; data: MarkupData; private: boolean; layer: string | null } {
  const kind = String(raw?.kind || '') as MarkupKind;
  if (!MARKUP_KINDS.includes(kind)) throw new Error('Unknown markup type.');
  const page = Math.floor(Number(raw?.page));
  if (!Number.isFinite(page) || page < 1 || page > 10000) throw new Error('Which page?');
  const d = raw?.data || {};
  const points: Pt[] = (Array.isArray(d.points) ? d.points : []).slice(0, MAX_POINTS)
    .filter((p: any) => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
    .map((p: any) => [clamp01(Number(p[0])), clamp01(Number(p[1]))] as Pt);
  const need = kind === 'text' || kind === 'pin' ? 1 : kind === 'measure_area' ? 3 : 2;
  if (points.length < need) throw new Error('The markup has no shape.');
  const data: MarkupData = {
    points,
    color: HEX.test(String(d.color)) ? String(d.color) : '#E0321B',
    width: Math.min(40, Math.max(0.5, Number(d.width) || 2)),
  };
  if (typeof d.text === 'string') data.text = d.text.slice(0, 2000);
  if (kind === 'text' && !data.text?.trim()) throw new Error('Type some text.');
  if (d.size !== undefined) data.size = Math.min(72, Math.max(6, Number(d.size) || 12));
  if (typeof d.label === 'string') data.label = d.label.slice(0, 60);
  if (kind === 'scale') {
    const real = Number(d.real);
    if (!(real > 0)) throw new Error('Type the real length of the line.');
    data.real = real;
    data.unit = d.unit === 'm' ? 'm' : 'ft';
  }
  if (kind === 'pin') { const photos = cleanPhotos(d.photos); if (photos.length) data.photos = photos; }
  return { kind, page, data, private: raw?.private === true, layer: cleanLayer(raw?.layer) };
}

/** Everyone's shared markups, and the caller's own private drafts. */
export function visibleTo<T extends { private?: boolean | null; authorId?: string | null }>(rows: T[], userId?: string): T[] {
  return rows.filter((m) => !m.private || (!!userId && m.authorId === userId));
}

export const canEditMarkup = (m: { authorId?: string | null }, who: { id?: string; isAdmin?: boolean }) => !!who.isAdmin || (!!who.id && m.authorId === who.id);

/**
 * A revision cloud around the box a-b: scallops along each side, bulging
 * outward, as quadratic curves (any SVG renderer and pdf-lib draw these).
 * Coordinates are in whatever space a and b are given in.
 */
export function cloudPath(a: Pt, b: Pt, scallop: number): string {
  const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
  const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  const corners: Pt[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let d = `M ${x0} ${y0}`;
  for (let i = 0; i < 4; i++) {
    const p = corners[i], q = corners[(i + 1) % 4];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const n = Math.max(1, Math.round(len / Math.max(scallop, 1e-6)));
    for (let k = 0; k < n; k++) {
      const s = [p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n];
      const e = [p[0] + ((q[0] - p[0]) * (k + 1)) / n, p[1] + ((q[1] - p[1]) * (k + 1)) / n];
      const m = [(s[0] + e[0]) / 2, (s[1] + e[1]) / 2];
      // Push the control point away from the box's centre: the bump faces out.
      const ox = m[0] - cx, oy = m[1] - cy;
      const nx = Math.abs(q[1] - p[1]) > Math.abs(q[0] - p[0]) ? Math.sign(ox) : 0;
      const ny = nx === 0 ? Math.sign(oy) : 0;
      const bulge = (len / n) * 0.6;
      d += ` Q ${m[0] + nx * bulge} ${m[1] + ny * bulge} ${e[0]} ${e[1]}`;
    }
  }
  return d + ' Z';
}

/** Two short strokes at the tip of an arrow from a to b. */
export function arrowHead(a: Pt, b: Pt, size: number): [Pt, Pt] {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const spread = Math.PI / 7;
  return [
    [b[0] - size * Math.cos(ang - spread), b[1] - size * Math.sin(ang - spread)],
    [b[0] - size * Math.cos(ang + spread), b[1] - size * Math.sin(ang + spread)],
  ];
}

const colorOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
/** Standard PDF fonts only know Latin-1: anything else becomes "?". */
const latin1 = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, '?');

/**
 * Where a shown point (0-1 across the page as displayed) sits on the page in
 * top-left points of the unrotated page, for a page rotated 0/90/180/270.
 */
export function toPage(p: Pt, w: number, h: number, rotation: number): Pt {
  const [u, v] = p;
  const r = ((rotation % 360) + 360) % 360;
  let x: number, yUp: number;
  if (r === 90) { x = v * w; yUp = u * h; }
  else if (r === 180) { x = w - u * w; yUp = v * h; }
  else if (r === 270) { x = w - v * w; yUp = h - u * h; }
  else { x = u * w; yUp = h - v * h; }
  return [x, h - yUp];
}

/** Draw one markup onto a pdf-lib page. */
function drawMarkup(page: PDFPage, font: PDFFont, kind: string, d: MarkupData) {
  const { width: w, height: h } = page.getSize();
  const rot = page.getRotation().angle;
  const pts = d.points.map((p) => toPage(p, w, h, rot));
  const color = colorOf(d.color);
  const path = (dStr: string, opts: { fill?: boolean; opacity?: number } = {}) => page.drawSvgPath(dStr, {
    x: 0, y: h, borderColor: color, borderWidth: d.width, borderOpacity: opts.opacity ?? 1,
    ...(opts.fill ? { color, opacity: opts.opacity ?? 0.15 } : {}),
  });
  const poly = (list: Pt[], close = false) => 'M ' + list.map((p) => `${p[0]} ${p[1]}`).join(' L ') + (close ? ' Z' : '');
  const label = (text: string, at: Pt, size = d.size || 11) => {
    // Upright as the page is shown: turn the text with the page's rotation.
    page.drawText(latin1(text), { x: at[0], y: h - at[1], size, font, color, rotate: degrees(rot) });
  };

  if (kind === 'pen') path(poly(pts));
  else if (kind === 'highlight') path(poly(pts), { opacity: 0.35 });
  else if (kind === 'line' || kind === 'measure_len' || kind === 'scale') {
    path(poly(pts.slice(0, 2)));
    if (d.label || kind === 'scale') label(d.label || `Scale: ${d.real} ${d.unit}`, [(pts[0][0] + pts[1][0]) / 2 + 4, (pts[0][1] + pts[1][1]) / 2 - 4]);
  } else if (kind === 'arrow') {
    const [a, b] = [pts[0], pts[pts.length - 1]];
    const [l, r] = arrowHead(a, b, Math.max(8, d.width * 4));
    path(`${poly([a, b])} M ${l[0]} ${l[1]} L ${b[0]} ${b[1]} L ${r[0]} ${r[1]}`);
  } else if (kind === 'rect') {
    path(poly([pts[0], [pts[1][0], pts[0][1]], pts[1], [pts[0][0], pts[1][1]]], true));
  } else if (kind === 'ellipse') {
    const [a, b] = [pts[0], pts[1]];
    page.drawEllipse({ x: (a[0] + b[0]) / 2, y: h - (a[1] + b[1]) / 2, xScale: Math.abs(b[0] - a[0]) / 2, yScale: Math.abs(b[1] - a[1]) / 2, borderColor: color, borderWidth: d.width });
  } else if (kind === 'cloud') {
    path(cloudPath(pts[0], pts[1], Math.max(10, Math.min(w, h) / 60)));
  } else if (kind === 'measure_area') {
    path(poly(pts, true), { fill: true });
    const c: Pt = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
    if (d.label) label(d.label, c);
  } else if (kind === 'pin') {
    // A filled dot with a white ring, and its note beside it.
    const p = pts[0];
    page.drawCircle({ x: p[0], y: h - p[1], size: 6, color, borderColor: rgb(1, 1, 1), borderWidth: 1.5 });
    const note = (d.text || '').split('\n')[0];
    const tag = [note, d.photos?.length ? `(${d.photos.length} photo${d.photos.length === 1 ? '' : 's'})` : ''].filter(Boolean).join(' ');
    if (tag) label(tag.slice(0, 80), [p[0] + 9, p[1] + 4], 9);
  } else if (kind === 'text') {
    const size = d.size || 12;
    (d.text || '').split('\n').forEach((line, i) => label(line, [pts[0][0], pts[0][1] + size * (i + 1)], size));
  }
}

/** The PDF with these markups drawn in (each on its own page). */
export async function flattenPdf(pdf: Buffer | Uint8Array, markups: { page: number; kind: string; data: MarkupData }[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  for (const m of markups) {
    const page = pages[m.page - 1];
    if (page) drawMarkup(page, font, m.kind, m.data);
  }
  return doc.save();
}
