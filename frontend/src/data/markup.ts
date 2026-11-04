/**
 * PDF markup (Oct 2026): a layer over a File Room PDF. Points are page-relative
 * (0-1 across the page as shown), so they hold at any zoom; widths and text
 * sizes are in PDF points. Mirrors backend/src/file-room/markups.ts.
 */
export type MarkupKind = 'pen' | 'highlight' | 'text' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'cloud' | 'measure_len' | 'measure_area' | 'scale' | 'pin' | 'link' | 'stamp'
  | 'polyline' | 'measure_path' | 'triangle' | 'polygon' | 'symbol';
export type Pt = [number, number];

export interface MarkupData {
  points: Pt[];
  color: string;
  width: number;
  /** Its CSI code (Nov 3 sync). */
  csiCodeId?: string;
  text?: string;
  size?: number;
  label?: string;
  real?: number;
  unit?: 'ft' | 'm';
  /** pin: site photos pinned to the spot (File Room files). */
  photos?: { fileId: string; name: string }[];
  /** link: where the box goes -- a page of this PDF, or another File Room file. */
  target?: LinkTarget;
  /** stamp: which icon (data/stamps.ts), drawn in the box its two points make. */
  icon?: string;
  /** A short note on any markup (Oct 31), shown as a small tag beside it. */
  note?: string;
  /** Box, ellipse, triangle, polyshape: a see-through fill of its colour. */
  fill?: boolean;
  /** text: the box's width (share of the page's width); the text wraps inside it. Older text has none and runs on. */
  boxW?: number;
  /** symbol: which library symbol, drawn in its box; `label` keeps its name for the hover and the list. */
  symbolId?: string;
}
/** A symbol from the shared library: its name and a small PNG/JPEG data URL. */
export interface MarkupSymbol { id: string; name: string; image: string }

export type LinkTarget = { type: 'page'; page: number } | { type: 'file'; fileId: string; name: string; page?: number };

/** What a link box says: "→ A501" (the sheet, when named), "→ p. 5", or "→ Inspection card 3.pdf, p. 2" (same as the server draws). */
export const linkLabel = (t?: LinkTarget | null, sheet?: (page: number) => string | undefined) =>
  !t ? 'Link' : t.type === 'page' ? `→ ${sheetNumberOf(sheet?.(t.page)) || `p. ${t.page}`}` : `→ ${t.name}${t.page ? `, p. ${t.page}` : ''}`;

/** A sheet name is "A-201 — FLOOR PLAN" (Nov 3 sync); links and tags show just the number. */
export const SHEET_SEP = ' — ';
export const sheetNumberOf = (name?: string | null) => (name ? name.split(SHEET_SEP)[0] : name || undefined);
export const sheetLabel = (num: string, title?: string | null) => (title ? `${num}${SHEET_SEP}${title}` : num).slice(0, 80);

/** Photos can be marked up too (Oct 31). */
export const isPhotoFile = (f: { name?: string; mimeType?: string | null }) => /\.(jpe?g|png|webp|gif)$/i.test(f.name || '') || /^image\/(jpeg|png|webp|gif)$/.test(f.mimeType || '');
/** A photo's page: its long side is this many points (the server sizes the downloaded PDF the same way). */
export const PHOTO_LONG_SIDE = 1200;

/** A sheet number as drawings write it: A100, E103, A-201, S2.1, M001A. */
const SHEET_RE = /^[A-Z]{1,3}[-.]?\s?\d{1,4}(?:\.\d{1,3})?[A-Z]?$/;

/**
 * A page's sheet number, read from its text (Oct 31): the biggest sheet-number-
 * looking text in the title block (bottom-right), else along the right edge
 * (a vertical title block). Null when there's none -- the page keeps "p. 3".
 */
export function sheetNameFrom(runs: { str: string; x0: number; y0: number; x1: number; y1: number }[]): string | null {
  const hits = runs.map((r) => ({ ...r, s: r.str.trim() })).filter((r) => SHEET_RE.test(r.s));
  const pick = (list: typeof hits) => list.sort((a, b) => (b.y1 - b.y0) - (a.y1 - a.y0))[0] || null;
  const num = pick(hits.filter((r) => r.x0 > 0.55 && r.y0 > 0.55)) || pick(hits.filter((r) => r.x0 > 0.8));
  if (!num) return null;
  // Its title (Nov 3 sync): the biggest words in the same title block, that aren't a label, scale, date or company line.
  const block = runs.map((r) => ({ ...r, s: r.str.replace(/\s+/g, ' ').trim() }))
    .filter((r) => r !== (num as any) && r.s !== num.s && isTitleText(r.s) && (num.x0 > 0.8 && num.y0 < 0.55 ? r.x0 > 0.8 : r.x0 > 0.55 && r.y0 > 0.5));
  const title = block.sort((a, b) => (b.y1 - b.y0) - (a.y1 - a.y0) || Math.abs(a.y0 - num.y0) - Math.abs(b.y0 - num.y0))[0]?.s;
  return sheetLabel(num.s, title || null);
}

/** Words that could be a sheet title: letters, not a title-block label, scale, date, phone or address line. */
const LABELS = /^(sheet|sheet (no|number|title)|scale|date|drawn( by)?|checked( by)?|project( no| number)?|title|revision|rev|issue|issued for|no\.?|job|client|owner|architect|engineer|seal|stamp|description|north)[.:]?$/i;
export function isTitleText(s: string): boolean {
  if (s.length < 3 || s.length > 60) return false;
  if (SHEET_RE.test(s) || LABELS.test(s)) return false;
  if (/["'=:]|\d+\/\d+|\d{4}|@|www\.|\.com|\(\d{3}\)|\d{3}[-. ]\d{4}/i.test(s)) return false;
  const letters = s.replace(/[^A-Za-z]/g, '').length;
  return letters >= 3 && letters / s.replace(/\s/g, '').length > 0.7 && !/(inc|llc|corp|design|build|architects?|engineering|residence|street|ave|blvd|road)\b/i.test(s);
}

/** From OCR'd title-block text (a scanned sheet): its sheet number and title, or null. */
export function sheetNameFromLines(text: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const nums = lines.map((l) => l.replace(/^sheet( no\.?| number)?[:\s]*/i, ''));
  const at = nums.findIndex((l) => SHEET_RE.test(l));
  if (at < 0) return null;
  // The title usually comes just above the number in the block; else the longest title-like line.
  const before = lines.slice(0, at).reverse().find(isTitleText);
  const title = before || lines.filter(isTitleText).sort((a, b) => b.length - a.length)[0];
  return sheetLabel(nums[at], title || null);
}
export interface Markup {
  id: string;
  fileId: string;
  page: number;
  kind: MarkupKind;
  data: MarkupData;
  authorId: string | null;
  authorName: string;
  private: boolean;
  /** Its named layer; null = its author's own layer. */
  layer?: string | null;
  linkType: MarkupLinkType | null;
  linkId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const KIND_LABEL: Record<MarkupKind, string> = {
  pen: 'Pen', highlight: 'Highlight', text: 'Text', line: 'Line', arrow: 'Arrow', rect: 'Box', ellipse: 'Ellipse', cloud: 'Cloud',
  measure_len: 'Length', measure_area: 'Area', scale: 'Scale', pin: 'Pin', link: 'Link', stamp: 'Stamp',
  polyline: 'Polyline', measure_path: 'Path length', triangle: 'Triangle', polygon: 'Polyshape', symbol: 'Symbol',
};

/** Shapes that can be filled (a see-through fill of their colour). */
export const FILLABLE: MarkupKind[] = ['rect', 'ellipse', 'triangle', 'polygon'];
/** Drawn by clicking points and double-clicking (or Enter) to finish. */
export const MULTI_POINT: MarkupKind[] = ['measure_area', 'measure_path', 'polyline', 'polygon'];
/** The fewest points each click-to-draw kind needs. */
export const MIN_POINTS: Partial<Record<MarkupKind, number>> = { measure_area: 3, polygon: 3, measure_path: 2, polyline: 2 };

/** A triangle in the box a-b: apex top-centre, base along the bottom. */
export function trianglePts(a: Pt, b: Pt): Pt[] {
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  return [[(x0 + x1) / 2, y0], [x1, y1], [x0, y1]];
}

/** Clicked points without the near-duplicates a double-click leaves (within `eps`, page share). */
export function dedupePoints(pts: Pt[], eps = 0.002): Pt[] {
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > eps);
}

/**
 * Text wrapped to a width: each paragraph broken at spaces, a word longer than
 * the line broken by letters. `measure` gives a string's width (same unit as maxW).
 * Mirrors the server, which wraps the same way when drawing the PDF.
 */
export function wrapLines(text: string, maxW: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/ +/);
    let line = '';
    for (let w of words) {
      while (measure(w) > maxW && w.length > 1) {
        // A long word: as many letters as fit, the rest on the next line.
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

/** The key a layer is shown, hidden and downloaded by (same as the server's). */
export const layerKey = (m: { layer?: string | null; authorId?: string | null; authorName?: string | null }) =>
  m.layer ? `L:${m.layer.toLowerCase()}` : `A:${m.authorId || m.authorName || ''}`;

export interface Layer { key: string; name: string; named: boolean; authorId: string | null; count: number }

/** The drawing's layers: named ones by name, the rest one per author ("Edward (you)"). Named ones first. */
export function layersOf(marks: Pick<Markup, 'layer' | 'authorId' | 'authorName'>[], me?: string): Layer[] {
  const map = new Map<string, Layer>();
  for (const m of marks) {
    const key = layerKey(m);
    const l = map.get(key) || {
      key, named: !!m.layer, authorId: m.layer ? null : m.authorId,
      name: m.layer || (m.authorId && m.authorId === me ? `${m.authorName} (you)` : m.authorName),
      count: 0,
    };
    l.count++;
    map.set(key, l);
  }
  return [...map.values()].sort((a, b) => Number(b.named) - Number(a.named) || a.name.localeCompare(b.name));
}
/** White last: drawn over black lines, it covers them (Oct 31). */
export const MARKUP_COLORS = ['#E0321B', '#1D4ED8', '#047857', '#B45309', '#7C3AED', '#111827', '#FACC15', '#FFFFFF'];

/** Who sees and manages every markup: i-1 (admin) and i-2 (principal). Mirrors the server. */
export const MARKUP_LEADS = ['admin', 'principal'];

/** A copy of a markup for pasting: nudged down-right on the same page, in place on another page; pin photos stay with the original. */
export function pasteCopy(m: Pick<Markup, 'kind' | 'data' | 'page'>, page: number): MarkupData {
  const off = m.page === page ? 0.015 : 0;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const copy: MarkupData = { ...m.data, points: m.data.points.map(([x, y]) => [clamp(x + off), clamp(y + off)] as Pt) };
  delete copy.photos;
  return copy;
}

/** A revision cloud around the box a-b (same shape as the server draws). */
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
      const ox = m[0] - cx, oy = m[1] - cy;
      const nx = Math.abs(q[1] - p[1]) > Math.abs(q[0] - p[0]) ? Math.sign(ox) : 0;
      const ny = nx === 0 ? Math.sign(oy) : 0;
      const bulge = (len / n) * 0.6;
      d += ` Q ${m[0] + nx * bulge} ${m[1] + ny * bulge} ${e[0]} ${e[1]}`;
    }
  }
  return d + ' Z';
}

export function arrowHead(a: Pt, b: Pt, size: number): [Pt, Pt] {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const spread = Math.PI / 7;
  return [
    [b[0] - size * Math.cos(ang - spread), b[1] - size * Math.sin(ang - spread)],
    [b[0] - size * Math.cos(ang + spread), b[1] - size * Math.sin(ang + spread)],
  ];
}

// ------------------------------------------------------------------ measuring

/** A line's length in PDF points on a page of w x h points (as shown). */
export const lengthPts = (a: Pt, b: Pt, w: number, h: number) => Math.hypot((b[0] - a[0]) * w, (b[1] - a[1]) * h);

/** A path's total length in PDF points (each segment added up). */
export function pathLengthPts(pts: Pt[], w: number, h: number) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += lengthPts(pts[i - 1], pts[i], w, h);
  return s;
}

/** A polygon's area in square PDF points. */
export function areaPts(pts: Pt[], w: number, h: number) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * w * (y2 * h) - x2 * w * (y1 * h);
  }
  return Math.abs(s) / 2;
}

/** The page's scale: real units (feet or metres) per PDF point. */
export function scaleFrom(m: Pick<Markup, 'data'>, w: number, h: number): { perPt: number; unit: 'ft' | 'm' } | null {
  const [a, b] = m.data.points;
  const pts = a && b ? lengthPts(a, b, w, h) : 0;
  if (!pts || !(Number(m.data.real) > 0)) return null;
  return { perPt: Number(m.data.real) / pts, unit: m.data.unit === 'm' ? 'm' : 'ft' };
}

/** 12.5 -> 12'-6"  (rounded to the nearest 1/4") */
export function feetInches(feet: number): string {
  const totalQ = Math.round(Math.abs(feet) * 48);
  const ft = Math.floor(totalQ / 48);
  const inQ = totalQ - ft * 48;
  const whole = Math.floor(inQ / 4);
  const frac = ['', '¼', '½', '¾'][inQ % 4];
  return `${feet < 0 ? '-' : ''}${ft}'-${whole}${frac}"`;
}

export function formatLength(real: number, unit: 'ft' | 'm') {
  return unit === 'm' ? `${real.toFixed(2)} m` : feetInches(real);
}
export function formatArea(real: number, unit: 'ft' | 'm') {
  return unit === 'm' ? `${real.toFixed(2)} m²` : `${real.toFixed(1)} sq ft`;
}

/**
 * A length as typed: 12'-6", 12' 6", 12.5', 150" (feet), or 3.81 / 3.81m
 * (metres when the unit is m). Null if it can't be read.
 */
export function parseLength(raw: string, unit: 'ft' | 'm'): number | null {
  const s = raw.trim().toLowerCase().replace(/[’′]/g, "'").replace(/[”″]/g, '"');
  if (!s) return null;
  if (unit === 'm') {
    const m = /^(\d+(?:\.\d+)?)\s*(m|mm|cm)?$/.exec(s);
    if (!m) return null;
    const n = Number(m[1]);
    return m[2] === 'mm' ? n / 1000 : m[2] === 'cm' ? n / 100 : n;
  }
  const fi = /^(\d+(?:\.\d+)?)\s*'\s*-?\s*(\d+(?:\.\d+)?)?\s*"?$/.exec(s);
  if (fi) return Number(fi[1]) + (fi[2] ? Number(fi[2]) / 12 : 0);
  const inch = /^(\d+(?:\.\d+)?)\s*"$/.exec(s);
  if (inch) return Number(inch[1]) / 12;
  const plain = /^(\d+(?:\.\d+)?)$/.exec(s);
  return plain ? Number(plain[1]) : null;
}

/** The measured value's label for a length or area markup on a page with this scale. */
export function measureLabel(kind: 'measure_len' | 'measure_area' | 'measure_path', pts: Pt[], w: number, h: number, scale: { perPt: number; unit: 'ft' | 'm' }) {
  if (kind === 'measure_len') return formatLength(lengthPts(pts[0], pts[1], w, h) * scale.perPt, scale.unit);
  if (kind === 'measure_path') return formatLength(pathLengthPts(pts, w, h) * scale.perPt, scale.unit);
  return formatArea(areaPts(pts, w, h) * scale.perPt * scale.perPt, scale.unit);
}

/** Where a markup sits, as a box (0-1), for selection and hit-testing. */
export function boundsOf(m: Pick<Markup, 'kind' | 'data'>, textW = 0.15, textH = 0.03) {
  const xs = m.data.points.map((p) => p[0]), ys = m.data.points.map((p) => p[1]);
  const box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  if (m.kind === 'pin') { box.x0 -= textW / 12; box.x1 += textW / 12; box.y0 -= textH * 1.5; box.y1 += textH / 3; }
  if (m.kind === 'text') { box.x1 += textW; box.y1 += textH * Math.max(1, (m.data.text || '').split('\n').length); }
  return box;
}

// ------------------------------------------------------------------ text size, search, rendering

/** Text sizes offered (PDF points). */
export const TEXT_SIZES = [8, 10, 12, 14, 18, 24, 36] as const;

/** The next size up (dir 1) or down (-1) from `size`, stopping at the ends. */
export function nextSize(size: number, dir: 1 | -1): number {
  if (dir > 0) return TEXT_SIZES.find((s) => s > size) ?? TEXT_SIZES[TEXT_SIZES.length - 1];
  return [...TEXT_SIZES].reverse().find((s) => s < size) ?? TEXT_SIZES[0];
}

/** One run of a page's text, as a box in page-relative (0-1, as shown) coordinates. */
export interface TextRun { str: string; x0: number; y0: number; x1: number; y1: number }
export interface TextHit { box: { x0: number; y0: number; x1: number; y1: number }; context: string }

/**
 * Where `query` appears in a page's text runs, case-insensitive. The box is
 * narrowed to the matched characters (pro rata across the run's width).
 */
export function textMatches(runs: TextRun[], query: string): TextHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: TextHit[] = [];
  for (const r of runs) {
    const s = r.str.toLowerCase();
    let i = s.indexOf(q);
    while (i >= 0) {
      const n = r.str.length || 1;
      const w = r.x1 - r.x0;
      out.push({
        box: { x0: r.x0 + (w * i) / n, x1: r.x0 + (w * (i + q.length)) / n, y0: r.y0, y1: r.y1 },
        context: r.str.trim().slice(0, 80),
      });
      i = s.indexOf(q, i + q.length);
    }
  }
  return out;
}

/** Most pixels a rendered page may have: beyond this browsers slow down or draw nothing. */
export const MAX_RENDER_PIXELS = 16_000_000;
const MAX_SIDE = 16_000;

/** The pdf.js render scale for a w x h (points) page at `scale`, sharp for the screen but within the canvas limits. */
/** Phones have less memory for a page picture: half the desktop limit keeps deep zoom from going blank (Nov 4). */
export const PHONE_RENDER_PIXELS = 8_000_000;
export function capRenderScale(w: number, h: number, scale: number, dpr: number, maxPixels = MAX_RENDER_PIXELS): number {
  const want = scale * dpr;
  const byArea = Math.sqrt(maxPixels / (w * h));
  const bySide = MAX_SIDE / Math.max(w, h);
  return Math.min(want, byArea, bySide);
}

// ------------------------------------------------------------------ comparing revisions

export type CompareShow = 'both' | 'older' | 'newer';

/**
 * Two renders of the same page (RGBA, same size) as one overlay: ink only in
 * the older version shows red, only in the newer blue, in both black. "older"
 * or "newer" shows just that version, in grey.
 */
export function overlayPixels(older: Uint8ClampedArray, newer: Uint8ClampedArray, out: Uint8ClampedArray, show: CompareShow = 'both') {
  for (let i = 0; i < out.length; i += 4) {
    const io = 1 - (older[i] * 0.299 + older[i + 1] * 0.587 + older[i + 2] * 0.114) / 255;
    const inw = 1 - (newer[i] * 0.299 + newer[i + 1] * 0.587 + newer[i + 2] * 0.114) / 255;
    if (show === 'both') {
      out[i] = 255 * (1 - inw);
      out[i + 1] = 255 * (1 - Math.min(1, io + inw));
      out[i + 2] = 255 * (1 - io);
    } else {
      const v = 255 * (1 - (show === 'older' ? io : inw));
      out[i] = out[i + 1] = out[i + 2] = v;
    }
    out[i + 3] = 255;
  }
  return out;
}

export interface Revision { id: string; name: string; updatedAt?: string; isLatest?: boolean }

/** Which revision to compare with by default: the one just before this, else the one just after. */
export function pickCompareDefault(currentId: string, revisions: Revision[]): Revision | null {
  const list = [...revisions].sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''));
  const i = list.findIndex((r) => r.id === currentId);
  if (i < 0) return list.filter((r) => r.id !== currentId).pop() || null;
  return list[i - 1] || list[i + 1] || null;
}

/** What a markup can be turned into (Oct 26 review notes, A6): an RFI, a task, a change order or a FOR RECORD item. */
export type MarkupLinkType = 'rfi' | 'task' | 'co' | 'record';
export const MARKUP_LINKS: Record<MarkupLinkType, { label: string; href: (id: string) => string }> = {
  rfi: { label: 'RFI', href: (id) => `/rfis?rfi=${encodeURIComponent(id)}` },
  task: { label: 'task', href: (id) => `/tasks?task=${encodeURIComponent(id)}&type=log` },
  co: { label: 'change order', href: (id) => `/changeorders?co=${encodeURIComponent(id)}` },
  record: { label: 'FOR RECORD item', href: (id) => `/observations?item=${encodeURIComponent(id)}` },
};
/** The link for whatever was made from a markup; null for an unknown kind (an older or bad row). */
export const markupLink = (type?: string | null, id?: string | null) => {
  const l = type ? MARKUP_LINKS[type as MarkupLinkType] : undefined;
  return l && id ? { label: l.label, href: l.href(id) } : null;
};

// ------------------------------------------------------------------ phones and tablets (Nov 4)

/** The tools in groups, for the phone's short tool bar: Select and Pan on their own, the rest one tap away. */
export const TOOL_GROUPS: { key: string; label: string; icon: string; tools: string[] }[] = [
  { key: 'select', label: 'Select', icon: '↖', tools: ['select'] },
  { key: 'pan', label: 'Move the sheet', icon: '✋', tools: ['pan'] },
  { key: 'draw', label: 'Draw', icon: '✎', tools: ['pen', 'highlight', 'line', 'arrow', 'polyline', 'cloud'] },
  { key: 'shapes', label: 'Shapes', icon: '▭', tools: ['rect', 'ellipse', 'triangle', 'polygon', 'symbol', 'stamp'] },
  { key: 'notes', label: 'Text, pins and links', icon: 'T', tools: ['text', 'pin', 'link'] },
  { key: 'measure', label: 'Measure', icon: '📏', tools: ['scale', 'measure_len', 'measure_path', 'measure_area'] },
];
export const groupOfTool = (tool: string) => TOOL_GROUPS.find((g) => g.tools.includes(tool))?.key || 'select';

/** A second tap close in time and place: finishes a polyline, or zooms (phones have no double-click). */
export function isDoubleTap(prev: { t: number; x: number; y: number } | null, next: { t: number; x: number; y: number }, ms = 320, px = 28): boolean {
  return !!prev && next.t - prev.t <= ms && Math.hypot(next.x - prev.x, next.y - prev.y) <= px;
}
