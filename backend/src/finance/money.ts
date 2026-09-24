/**
 * Money is handled in integer cents end to end: decimals come out of the
 * database as numbers and are converted once, so sums never drift.
 */

/** Dollars (number or numeric string) to integer cents. EPSILON keeps 1.005 from becoming 100. */
export const toCents = (v: number | string | null | undefined): number => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Math.sign(n) * Number.EPSILON) * 100);
};

export const fromCents = (c: number): number => Math.round(c) / 100;

export const sumCents = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** pct% of an amount in cents, rounded half away from zero to the cent. */
export const pctOf = (cents: number, pct: number | null | undefined): number => {
  const p = Number(pct) || 0;
  const raw = (cents * p) / 100;
  return Math.sign(raw) * Math.round(Math.abs(raw) + Number.EPSILON);
};

/** A percentage rounded to 2 dp, as stored. */
export const roundPct = (p: number) => Math.round((Number(p) || 0) * 100) / 100;

/**
 * Split `total` cents in proportion to `weights`. Every share is rounded down;
 * whatever cents remain go to the line with the largest weight, so the parts
 * always add up exactly to the total.
 */
export function allocate(total: number, weights: number[]): number[] {
  const out = weights.map(() => 0);
  const sum = sumCents(weights.map((w) => Math.max(0, w)));
  if (!weights.length || sum <= 0 || total === 0) return out;
  weights.forEach((w, i) => { out[i] = Math.floor((total * Math.max(0, w)) / sum); });
  const rest = total - sumCents(out);
  if (rest) {
    let largest = 0;
    weights.forEach((w, i) => { if (w > weights[largest]) largest = i; });
    out[largest] += rest;
  }
  return out;
}
