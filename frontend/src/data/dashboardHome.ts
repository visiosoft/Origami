/**
 * The Glass dashboard (Oct 29): small pure helpers for its charts and tiles.
 * Every figure comes from the live system; nothing here invents history.
 */

export type Pt = [number, number];

/** A smooth line through the points (Catmull-Rom as cubic Béziers) for an SVG path. */
export function smoothPath(pts: Pt[]): string {
  if (!pts.length) return '';
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${r(c1[0])},${r(c1[1])} ${r(c2[0])},${r(c2[1])} ${r(p2[0])},${r(p2[1])}`;
  }
  return d;
}
const r = (n: number) => Math.round(n * 10) / 10;

/** Values laid out across a w×h box (top = max), with a little headroom; flat when they're all equal. */
export function plot(values: number[], w: number, h: number, max = Math.max(0, ...values), pad = 4): Pt[] {
  if (!values.length) return [];
  const top = max > 0 ? max : 1;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values.map((v, i) => [r(pad + i * step), r(h - pad - (Math.max(0, v) / top) * (h - pad * 2))]);
}

/** A round axis top and its ticks for a chart (0, then 4 steps). */
export function niceAxis(max: number): number[] {
  if (!(max > 0)) return [0, 1, 2, 3, 4];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  return [0, 1, 2, 3, 4].map((i) => i * step);
}

/** This month against the month before, as "↑ 12%" / "↓ 4%"; null without both, or when the earlier one is 0. */
export function trend(series: number[]): { up: boolean; pct: number } | null {
  if (series.length < 2) return null;
  const a = series[series.length - 2], b = series[series.length - 1];
  if (!(a > 0)) return null;
  const pct = Math.round(((b - a) / a) * 100);
  return { up: pct >= 0, pct: Math.abs(pct) };
}

export type Tone = 'good' | 'warn' | 'bad' | 'info';
/** How a notification reads at a glance: done / waiting / gone wrong / just news. */
export function toneOf(event: string, title = ''): Tone {
  const t = `${event} ${title}`.toLowerCase();
  if (/(overdue|fail|reject|declin|expired|bounce|error|past due)/.test(t)) return 'bad';
  if (/(approv|\bsigned|\bpaid|complet|\bdone\b|\bwon\b|closed|confirmed|accepted)/.test(t)) return 'good';
  if (/(review|waiting|pending|hold|due|remind|request|submitted)/.test(t)) return 'warn';
  return 'info';
}

/** "2m ago", "3h ago", "Yesterday", "Oct 21". */
export function ago(at: string, now = new Date()): string {
  const t = new Date(at).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (now.getTime() - t) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 172800) return 'Yesterday';
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Shares of a donut as stroke-dasharray offsets on a circle of the given circumference; a small gap between parts. */
export function donutArcs(parts: number[], circumference: number, gap = 4): { len: number; offset: number }[] {
  const total = parts.reduce((a, n) => a + Math.max(0, n), 0);
  if (!total) return parts.map(() => ({ len: 0, offset: 0 }));
  const shown = parts.filter((n) => n > 0).length;
  const g = shown > 1 ? gap : 0;
  let at = 0;
  return parts.map((n) => {
    const full = (Math.max(0, n) / total) * circumference;
    const arc = { len: n > 0 ? Math.max(0.5, full - g) : 0, offset: -at };
    at += full;
    return arc;
  });
}
