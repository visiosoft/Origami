import { PDFDocument, PDFName, PDFString, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { STAMP_KEYS, stampStrokes } from './stamps';

/**
 * PDF markup (Oct 2026): what a markup is, who sees it, and how it's drawn into
 * a PDF. Points are page-relative (0-1) on the page as it's shown (after the
 * page's own rotation); widths and text sizes are in PDF points.
 */
export const MARKUP_KINDS = ['pen', 'highlight', 'text', 'line', 'arrow', 'rect', 'ellipse', 'cloud', 'measure_len', 'measure_area', 'scale', 'pin', 'link', 'stamp',
  'polyline', 'measure_path', 'triangle', 'polygon', 'symbol'] as const;
/** Shapes that can carry a see-through fill (Oct 31). */
export const FILLABLE = ['rect', 'ellipse', 'triangle', 'polygon'];
export type MarkupKind = (typeof MARKUP_KINDS)[number];
export type Pt = [number, number];

export interface MarkupData {
  points: Pt[];
  color: string;
  width: number;
  /** Its CSI code (Nov 3 sync). */
  csiCodeId?: string;
  text?: string;
  size?: number;
  /** measure_len / measure_area: the value as shown ("12'-6\""); scale: the real length typed in. */
  label?: string;
  real?: number;
  unit?: 'ft' | 'm';
  /** pin: site photos pinned to the spot (File Room files). */
  photos?: PinPhoto[];
  /** link: where the box goes -- a page of this PDF, or another File Room file. */
  target?: LinkTarget;
  /** stamp: which icon (file-room/stamps.ts), drawn in the box its two points make. */
  icon?: string;
  /** A short note on any markup (Oct 31), shown as a small tag beside it. */
  note?: string;
  /** Box, ellipse, triangle, polyshape: a see-through fill of its colour. */
  fill?: boolean;
  /** text: the box's width (share of the page's width); the text wraps inside it. */
  boxW?: number;
  /** symbol: which library symbol, drawn in the box its two points make; `label` keeps its name. */
  symbolId?: string;
}

/** A symbol image as stored: a PNG or JPEG data URL of at most ~300 KB. Throws otherwise. */
export function cleanSymbolImage(v: unknown): string {
  const s = String(v || '');
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(s);
  if (!m) throw new Error('Upload a PNG, JPG or SVG image.');
  if ((m[2].length * 3) / 4 > 300 * 1024) throw new Error('That image is too big for a symbol (300 KB at most).');
  return s;
}
export const cleanSymbolName = (v: unknown) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!s) throw new Error('Give the symbol a name — it shows when someone points at it.');
  return s;
};

export type LinkTarget = { type: 'page'; page: number } | { type: 'file'; fileId: string; name: string; page?: number };

/** A link's target, cleaned; null if it doesn't point anywhere. */
export function cleanTarget(v: any): LinkTarget | null {
  const page = (n: unknown) => { const p = Math.floor(Number(n)); return Number.isFinite(p) && p >= 1 && p <= 10000 ? p : null; };
  if (v?.type === 'page') { const p = page(v.page); return p ? { type: 'page', page: p } : null; }
  if (v?.type === 'file' && typeof v.fileId === 'string' && v.fileId.trim()) {
    const t: LinkTarget = { type: 'file', fileId: v.fileId.trim().slice(0, 80), name: String(v.name || 'File').slice(0, 200) };
    const p = page(v.page);
    if (p) t.page = p;
    return t;
  }
  return null;
}

/** What a link box says: "→ A501" (the sheet, when named), "→ p. 5", or "→ Inspection card 3.pdf, p. 2". */
export const linkLabel = (t?: LinkTarget | null, sheet?: (page: number) => string | undefined) =>
  !t ? 'Link' : t.type === 'page' ? `→ ${sheet?.(t.page) || `p. ${t.page}`}` : `→ ${t.name}${t.page ? `, p. ${t.page}` : ''}`;

/** Sheet names as stored: page number → a short name (A100, E103.1), anything else dropped. */
export function cleanSheetNames(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const page = Math.floor(Number(k));
    const name = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 80); // "A-201 — FLOOR PLAN" (Nov 3 sync)
    if (page >= 1 && page <= 10000 && name) out[String(page)] = name;
  }
  return out;
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
  const need = kind === 'text' || kind === 'pin' ? 1 : kind === 'measure_area' || kind === 'polygon' ? 3 : 2;
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
  if (typeof d.csiCodeId === 'string' && d.csiCodeId.trim()) data.csiCodeId = d.csiCodeId.trim().slice(0, 40);
  if (FILLABLE.includes(kind) && d.fill === true) data.fill = true;
  if (kind === 'text' && Number(d.boxW) > 0) data.boxW = Math.min(1, Math.max(0.02, Number(d.boxW)));
  // Notes stay in the side panel and list (Nov 3 sync), so they can be longer; line breaks are kept.
  if (typeof d.note === 'string' && d.note.trim()) data.note = String(d.note).split(/\r?\n/).map((l: string) => l.replace(/\s+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1000);
  if (kind === 'scale') {
    const real = Number(d.real);
    if (!(real > 0)) throw new Error('Type the real length of the line.');
    data.real = real;
    data.unit = d.unit === 'm' ? 'm' : 'ft';
  }
  if (kind === 'pin') { const photos = cleanPhotos(d.photos); if (photos.length) data.photos = photos; }
  if (kind === 'symbol') {
    if (typeof d.symbolId !== 'string' || !d.symbolId.trim()) throw new Error('Pick a symbol.');
    data.symbolId = d.symbolId.trim().slice(0, 80);
  }
  if (kind === 'stamp') data.icon = STAMP_KEYS.includes(String(d.icon)) ? String(d.icon) : 'check';
  if (kind === 'link') {
    const target = cleanTarget(d.target);
    if (!target) throw new Error('Pick the page or file the link goes to.');
    data.target = target;
  }
  return { kind, page, data, private: raw?.private === true, layer: cleanLayer(raw?.layer) };
}

/** The internal leadership, "i-1" (admin) and "i-2" (principal): they see and manage every markup (Oct 31). */
export const MARKUP_LEADS = ['admin', 'principal'];
export const leadsMarkups = (roleKey?: string | null) => MARKUP_LEADS.includes(String(roleKey || ''));

/** Everyone's shared markups, and the caller's own private drafts; i-1 and i-2 see every markup. */
export function visibleTo<T extends { private?: boolean | null; authorId?: string | null }>(rows: T[], userId?: string, roleKey?: string | null): T[] {
  if (leadsMarkups(roleKey)) return rows;
  return rows.filter((m) => !m.private || (!!userId && m.authorId === userId));
}

// ---------------------------------------------------------------- layer access (Oct 30 sync)
export type LayerAudience = 'everyone' | 'internal' | 'people';
export interface LayerPerson { type: 'user' | 'company'; id: string; name: string }
export interface LayerRule { layerKey: string; audience: LayerAudience; people?: LayerPerson[] | null }
/** Who's looking: our team or not, and the company on their People record. */
export interface LayerViewer { userId?: string; roleKey?: string | null; internal: boolean; company?: string | null }

/** A layer's audience, cleaned; anything unknown is everyone. */
export function cleanLayerRule(raw: any): { audience: LayerAudience; people: LayerPerson[] } {
  const audience: LayerAudience = raw?.audience === 'internal' || raw?.audience === 'people' ? raw.audience : 'everyone';
  const people = audience === 'people'
    ? (Array.isArray(raw?.people) ? raw.people : [])
      .filter((p: any) => (p?.type === 'user' || p?.type === 'company') && String(p?.id || '').trim())
      .slice(0, 50)
      .map((p: any) => ({ type: p.type, id: String(p.id).trim().slice(0, 120), name: String(p.name || p.id).trim().slice(0, 120) }))
    : [];
  if (audience === 'people' && !people.length) throw new Error('Pick at least one person or company.');
  return { audience, people };
}

const sameCompany = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** May this viewer see markups on this layer? Our team always sees an Internal or picked layer. */
export function layerAllows(rule: LayerRule | undefined, v: LayerViewer): boolean {
  if (!rule || rule.audience === 'everyone') return true;
  if (v.internal || leadsMarkups(v.roleKey)) return true;
  if (rule.audience === 'internal') return false;
  return (rule.people || []).some((p) => (p.type === 'user' && p.id === v.userId) || (p.type === 'company' && sameCompany(p.id, v.company)));
}

/** visibleTo plus layer access: a markup's author always sees their own. */
export function visibleWithLayers<T extends { private?: boolean | null; authorId?: string | null; layer?: string | null; authorName?: string | null }>(rows: T[], rules: LayerRule[], v: LayerViewer): T[] {
  const byKey = new Map(rules.map((r) => [r.layerKey, r]));
  return visibleTo(rows, v.userId, v.roleKey).filter((m) => (!!v.userId && m.authorId === v.userId) || layerAllows(byKey.get(layerKey(m)), v));
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

/** A triangle in the box a-b: apex top-centre, base along the bottom (same as the viewer). */
export function trianglePts(a: Pt, b: Pt): Pt[] {
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  return [[(x0 + x1) / 2, y0], [x1, y1], [x0, y1]];
}

/** Text wrapped to a width, word by word (a too-long word by letters). Mirrors frontend data/markup.ts. */
export function wrapLines(text: string, maxW: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/ +/);
    let line = '';
    for (let w of words) {
      while (measure(w) > maxW && w.length > 1) {
        if (line) { out.push(line); line = ''; }
        let n = w.length - 1;
        while (n > 1 && measure(w.slice(0, n)) > maxW) n--;
        out.push(w.slice(0, n));
        w = w.slice(n);
      }
      const next = line ? `${line} ${w}` : w;
      if (line && measure(next) > maxW) { out.push(line); line = w; } else line = next;
    }
    out.push(line);
  }
  return out;
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
function drawMarkup(page: PDFPage, font: PDFFont, kind: string, d: MarkupData, sheet?: (page: number) => string | undefined) {
  // A markup's note stays in the list, not on the sheet (Nov 3 sync); only the shape (and a text box's own text) is drawn.
  drawShape(page, font, kind, d, sheet);
}

function drawShape(page: PDFPage, font: PDFFont, kind: string, d: MarkupData, sheet?: (page: number) => string | undefined) {
  const { width: w, height: h } = page.getSize();
  const rot = page.getRotation().angle;
  const pts = d.points.map((p) => toPage(p, w, h, rot));
  const color = colorOf(d.color);
  const path = (dStr: string, opts: { fill?: boolean; opacity?: number; fillOpacity?: number } = {}) => page.drawSvgPath(dStr, {
    x: 0, y: h, borderColor: color, borderWidth: d.width, borderOpacity: opts.opacity ?? 1,
    ...(opts.fill ? { color, opacity: opts.fillOpacity ?? opts.opacity ?? 0.15 } : {}),
  });
  const poly = (list: Pt[], close = false) => 'M ' + list.map((p) => `${p[0]} ${p[1]}`).join(' L ') + (close ? ' Z' : '');
  const label = (text: string, at: Pt, size = d.size || 11) => {
    // Upright as the page is shown: turn the text with the page's rotation.
    page.drawText(latin1(text), { x: at[0], y: h - at[1], size, font, color, rotate: degrees(rot) });
  };

  const fillIt = d.fill === true;
  if (kind === 'pen' || kind === 'polyline') path(poly(pts));
  else if (kind === 'measure_path') {
    path(poly(pts));
    const last = pts.length - 1;
    if (d.label) label(d.label, [(pts[last - 1][0] + pts[last][0]) / 2 + 4, (pts[last - 1][1] + pts[last][1]) / 2 - 4]);
  } else if (kind === 'triangle') {
    path(poly(trianglePts(d.points[0], d.points[1]).map((p) => toPage(p, w, h, rot)), true), { fill: fillIt, fillOpacity: 0.25 });
  } else if (kind === 'polygon') {
    path(poly(pts, true), { fill: fillIt, fillOpacity: 0.25 });
  }
  else if (kind === 'highlight') path(poly(pts), { opacity: 0.35 });
  else if (kind === 'line' || kind === 'measure_len' || kind === 'scale') {
    path(poly(pts.slice(0, 2)));
    if (d.label || kind === 'scale') label(d.label || `Scale: ${d.real} ${d.unit}`, [(pts[0][0] + pts[1][0]) / 2 + 4, (pts[0][1] + pts[1][1]) / 2 - 4]);
  } else if (kind === 'arrow') {
    const [a, b] = [pts[0], pts[pts.length - 1]];
    const [l, r] = arrowHead(a, b, Math.max(8, d.width * 4));
    path(`${poly([a, b])} M ${l[0]} ${l[1]} L ${b[0]} ${b[1]} L ${r[0]} ${r[1]}`);
  } else if (kind === 'rect') {
    path(poly([pts[0], [pts[1][0], pts[0][1]], pts[1], [pts[0][0], pts[1][1]]], true), { fill: fillIt, fillOpacity: 0.25 });
  } else if (kind === 'ellipse') {
    const [a, b] = [pts[0], pts[1]];
    page.drawEllipse({ x: (a[0] + b[0]) / 2, y: h - (a[1] + b[1]) / 2, xScale: Math.abs(b[0] - a[0]) / 2, yScale: Math.abs(b[1] - a[1]) / 2, borderColor: color, borderWidth: d.width, ...(fillIt ? { color, opacity: 0.25 } : {}) });
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
  } else if (kind === 'link') {
    const [a, b] = [pts[0], pts[1]];
    page.drawSvgPath(poly([a, [b[0], a[1]], b, [a[0], b[1]]], true), { x: 0, y: h, borderColor: color, borderWidth: d.width, borderDashArray: [4, 3] });
    label(linkLabel(d.target, sheet).slice(0, 80), [Math.min(a[0], b[0]), Math.min(a[1], b[1]) - 3], 9);
  } else if (kind === 'stamp') {
    // Stroked into its box, each point placed like any other (so rotated pages are right).
    for (const line of stampStrokes(d.icon || 'check', d.points[0], d.points[1])) path(poly(line.map((p) => toPage(p, w, h, rot))));
  } else if (kind === 'text') {
    const size = d.size || 12;
    // A sized box wraps its text (Oct 31); older text runs on, line by line as typed.
    const pageW = rot % 180 ? h : w;
    const lines = d.boxW ? wrapLines(latin1(d.text || ''), d.boxW * pageW, (s) => font.widthOfTextAtSize(s, size)) : (d.text || '').split('\n');
    lines.forEach((line, i) => label(line, [pts[0][0], pts[0][1] + size * 1.2 * i + size], size));
  }
}

/** What can be marked up (Oct 31): PDFs, and photos (JPG / PNG, plus WebP / GIF on screen). */
export const isPdfName = (f: { name?: string; mimeType?: string | null }) => /\.pdf$/i.test(f.name || '') || f.mimeType === 'application/pdf';
export const isPhotoName = (f: { name?: string; mimeType?: string | null }) => /\.(jpe?g|png|webp|gif)$/i.test(f.name || '') || /^image\/(jpeg|png|webp|gif)$/.test(f.mimeType || '');
export const isMarkable = (f: { name?: string; mimeType?: string | null }) => isPdfName(f) || isPhotoName(f);

/** A photo's page size: its long side is this many points, so text and line widths read the same as on a drawing (the viewer does the same). */
export const PHOTO_LONG_SIDE = 1200;
export function photoPageSize(wPx: number, hPx: number): [number, number] {
  const k = PHOTO_LONG_SIDE / Math.max(wPx, hPx, 1);
  return [wPx * k, hPx * k];
}

/** A one-page PDF of a JPG or PNG photo, sized like the viewer shows it, for drawing markups into. */
export async function photoToPdf(bytes: Uint8Array, name: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!isPng && !isJpg) throw new Error(`Downloading a marked-up photo works for JPG and PNG photos; ${name} is another kind.`);
  const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  const [w, h] = photoPageSize(img.width, img.height);
  doc.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
  return doc.save();
}

/**
 * The PDF with these markups drawn in (each on its own page). Link boxes
 * also become clickable: a page link jumps within the PDF, a file link opens
 * the file in the app (when `fileUrl` is given).
 */
export async function flattenPdf(
  pdf: Buffer | Uint8Array,
  markups: { page: number; kind: string; data: MarkupData }[],
  opts: { fileUrl?: (fileId: string) => string; sheetNames?: Record<string, string> | null; symbols?: Record<string, { name: string; image: string }> } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const embedded = new Map<string, Awaited<ReturnType<PDFDocument['embedPng']>> | null>();
  for (const m of markups) {
    const page = pages[m.page - 1];
    if (!page) continue;
    if (m.kind === 'symbol') { await drawSymbol(doc, page, font, m.data, opts.symbols, embedded); continue; }
    // Links and tags show the sheet number only (the name may carry its title).
    drawMarkup(page, font, m.kind, m.data, (n) => opts.sheetNames?.[String(n)]?.split(' — ')[0]);
    if (m.kind === 'link' && m.data.target) addLinkAnnotation(doc, page, pages, m.data, opts.fileUrl);
  }
  return doc.save();
}

/** A library symbol, its image laid into the markup's box; a labelled box when the symbol was since deleted. */
async function drawSymbol(doc: PDFDocument, page: PDFPage, font: PDFFont, d: MarkupData, symbols: Record<string, { name: string; image: string }> | undefined, cache: Map<string, any>) {
  const { width: w, height: h } = page.getSize();
  const rot = page.getRotation().angle;
  const [a, b] = [d.points[0], d.points[1] || d.points[0]].map((p) => toPage(p, w, h, rot));
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  const sym = d.symbolId ? symbols?.[d.symbolId] : undefined;
  if (sym && !cache.has(d.symbolId!)) {
    const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(sym.image);
    const bytes = m ? Buffer.from(m[2], 'base64') : null;
    cache.set(d.symbolId!, bytes ? await (m![1] === 'png' ? doc.embedPng(bytes) : doc.embedJpg(bytes)).catch(() => null) : null);
  }
  const img = sym ? cache.get(d.symbolId!) : null;
  if (img) {
    // Fit inside the box, keeping its shape.
    const k = Math.min((x1 - x0) / img.width, (y1 - y0) / img.height);
    const iw = img.width * k, ih = img.height * k;
    page.drawImage(img, { x: x0 + (x1 - x0 - iw) / 2, y: h - y0 - (y1 - y0 + ih) / 2, width: iw, height: ih });
  } else {
    page.drawRectangle({ x: x0, y: h - y1, width: x1 - x0, height: y1 - y0, borderColor: rgb(0.4, 0.4, 0.4), borderWidth: 1 });
    page.drawText(latin1((d.label || 'Symbol').slice(0, 40)), { x: x0 + 2, y: h - y0 - 10, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
  }
}

function addLinkAnnotation(doc: PDFDocument, page: PDFPage, pages: PDFPage[], d: MarkupData, fileUrl?: (id: string) => string) {
  const t = d.target!;
  const { width: w, height: h } = page.getSize();
  const [a, b] = d.points.slice(0, 2).map((p) => toPage(p, w, h, page.getRotation().angle));
  const rect = [Math.min(a[0], b[0]), h - Math.max(a[1], b[1]), Math.max(a[0], b[0]), h - Math.min(a[1], b[1])];
  let action: Record<string, unknown> | null = null;
  if (t.type === 'page') {
    const dest = pages[t.page - 1];
    if (!dest) return;
    action = { Dest: [dest.ref, PDFName.of('Fit')] };
  } else if (fileUrl) {
    action = { A: { Type: 'Action', S: 'URI', URI: PDFString.of(fileUrl(t.fileId)) } };
  }
  if (!action) return;
  const annot = doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: rect, Border: [0, 0, 0], ...action } as any);
  const ref = doc.context.register(annot);
  const existing = page.node.Annots();
  if (existing) existing.push(ref);
  else page.node.set(PDFName.of('Annots'), doc.context.obj([ref]));
}
