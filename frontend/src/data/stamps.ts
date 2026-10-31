/**
 * Stamp icons for drawings (Oct 26 review notes): dropped on a PDF in a box,
 * so they scale with the drawing. Each is a few strokes in a 24 x 24 box,
 * drawn the same way on screen and in the downloaded PDF. Mirrors backend
 * file-room/stamps.ts (keep the two the same).
 */
type P = [number, number];
const circle = (cx: number, cy: number, r: number, n = 24): P[] =>
  Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI)] as P);

export const STAMPS: Record<string, { label: string; strokes: P[][] }> = {
  check: { label: 'Check / approved', strokes: [[[4, 12.5], [9.5, 18], [20, 6]]] },
  cross: { label: 'X / rejected', strokes: [[[5, 5], [19, 19]], [[19, 5], [5, 19]]] },
  warning: { label: 'Warning', strokes: [[[12, 3], [22, 20], [2, 20], [12, 3]], [[12, 9], [12, 14]], [[12, 16.5], [12, 17.5]]] },
  question: { label: 'Question', strokes: [circle(12, 12, 10), [[9, 9.5], [9.6, 7.6], [12, 6.8], [14.4, 7.6], [15, 9.5], [14, 11.2], [12, 12.4], [12, 14.2]], [[12, 16.8], [12, 17.8]]] },
  north: { label: 'North arrow', strokes: [[[12, 2], [18, 21], [12, 16], [6, 21], [12, 2]], [[12, 2], [12, 16]]] },
  section: { label: 'Section bubble', strokes: [circle(12, 12, 9), [[3, 12], [21, 12]]] },
  detail: { label: 'Detail bubble', strokes: [circle(12, 12, 9), [[3, 12], [21, 12]], [[12, 3], [12, 12]]] },
};
export const STAMP_KEYS = Object.keys(STAMPS);

/** A stamp's strokes laid into its box (two opposite corners, page-relative 0-1). */
export function stampStrokes(icon: string, a: P, b: P): P[][] {
  const s = STAMPS[icon] || STAMPS.check;
  const x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]);
  const w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]);
  return s.strokes.map((line) => line.map(([x, y]) => [x0 + (x / 24) * w, y0 + (y / 24) * h] as P));
}
