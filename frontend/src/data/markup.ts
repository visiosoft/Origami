/**
 * PDF markup (Oct 2026): a layer over a File Room PDF. Points are page-relative
 * (0-1 across the page as shown), so they hold at any zoom; widths and text
 * sizes are in PDF points. Mirrors backend/src/file-room/markups.ts.
 */
export type MarkupKind = 'pen' | 'highlight' | 'text' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'cloud' | 'measure_len' | 'measure_area' | 'scale';
export type Pt = [number, number];

export interface MarkupData {
  points: Pt[];
  color: string;
  width: number;
  text?: string;
  size?: number;
  label?: string;
  real?: number;
  unit?: 'ft' | 'm';
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
  linkType: 'rfi' | 'task' | null;
  linkId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const KIND_LABEL: Record<MarkupKind, string> = {
  pen: 'Pen', highlight: 'Highlight', text: 'Text', line: 'Line', arrow: 'Arrow', rect: 'Box', ellipse: 'Ellipse', cloud: 'Cloud',
  measure_len: 'Length', measure_area: 'Area', scale: 'Scale',
};
export const MARKUP_COLORS = ['#E0321B', '#1D4ED8', '#047857', '#B45309', '#7C3AED', '#111827', '#FACC15'];

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
export function measureLabel(kind: 'measure_len' | 'measure_area', pts: Pt[], w: number, h: number, scale: { perPt: number; unit: 'ft' | 'm' }) {
  return kind === 'measure_len'
    ? formatLength(lengthPts(pts[0], pts[1], w, h) * scale.perPt, scale.unit)
    : formatArea(areaPts(pts, w, h) * scale.perPt * scale.perPt, scale.unit);
}

/** Where a markup sits, as a box (0-1), for selection and hit-testing. */
export function boundsOf(m: Pick<Markup, 'kind' | 'data'>, textW = 0.15, textH = 0.03) {
  const xs = m.data.points.map((p) => p[0]), ys = m.data.points.map((p) => p[1]);
  const box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  if (m.kind === 'text') { box.x1 += textW; box.y1 += textH * Math.max(1, (m.data.text || '').split('\n').length); }
  return box;
}
