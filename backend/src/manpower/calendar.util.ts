/** Pure date helpers on ISO yyyy-mm-dd strings, computed in UTC so no timezone can shift a day. */

const DAY = 86400000;
const ms = (d: string) => Date.parse(d + 'T00:00:00Z');
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export const addDays = (d: string, n: number) => iso(ms(d) + n * DAY);
export const daysBetween = (from: string, to: string) => Math.round((ms(to) - ms(from)) / DAY);
export const weekday = (d: string) => new Date(ms(d)).getUTCDay();

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = ms(from); t <= ms(to); t += DAY) out.push(iso(t));
  return out;
}

/** Days in [from, to] that are neither a weekend day nor a public holiday. */
export function workingDays(from: string, to: string, weekendDays: number[], holidays: Set<string>): string[] {
  if (to < from) return [];
  return eachDate(from, to).filter((d) => !weekendDays.includes(weekday(d)) && !holidays.has(d));
}

/** Overlap of two inclusive date ranges, or null. */
export function overlap(a1: string, a2: string, b1: string, b2: string): [string, string] | null {
  const s = a1 > b1 ? a1 : b1;
  const e = a2 < b2 ? a2 : b2;
  return s <= e ? [s, e] : null;
}

/** Which template a (possibly rotating) shift assignment puts someone on for a date, or null if it doesn't cover it. */
export function shiftOn(a: { templateIds: string[]; rotateEveryDays?: number | null; startDate: string; endDate?: string | null }, date: string): string | null {
  if (!a.templateIds?.length || date < a.startDate || (a.endDate && date > a.endDate)) return null;
  if (a.templateIds.length === 1) return a.templateIds[0];
  const every = Math.max(1, Number(a.rotateEveryDays) || 7);
  return a.templateIds[Math.floor(daysBetween(a.startDate, date) / every) % a.templateIds.length];
}

export const yearOf = (d: string) => Number(d.slice(0, 4));
