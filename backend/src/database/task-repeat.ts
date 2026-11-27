/**
 * Nov 27 (Weekly Sync: "a recurring option, like a calendar invite"; Astrid:
 * "it shouldn't create different tasks every day"): one task that repeats.
 * Its due date is always the next time it's due, so the daily reminder
 * reminds on each day it repeats; completing it moves the due date on and
 * reopens it. Pure helpers, so the board, the log and the reminders agree.
 */
export type RepeatEvery = 'day' | 'weekdays' | 'week' | 'month';
/** `anchor`: the day it was first due -- weekly and monthly repeats follow it (Jan 31 -> Feb 28 -> Mar 31). */
export interface RepeatRule { every: RepeatEvery; days?: number[]; until?: string | null; anchor?: string | null }

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const parse = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = parse(iso); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
const weekday = (iso: string) => parse(iso).getUTCDay();

/** A tidy rule from whatever was sent; null = doesn't repeat. */
export function cleanRepeat(raw: unknown): RepeatRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const every = String(r.every || '') as RepeatEvery;
  if (!['day', 'weekdays', 'week', 'month'].includes(every)) return null;
  const days = every === 'week' ? [...new Set((Array.isArray(r.days) ? r.days : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort() : undefined;
  const until = typeof r.until === 'string' && ISO.test(r.until) ? r.until : null;
  const anchor = typeof r.anchor === 'string' && ISO.test(r.anchor) ? r.anchor : null;
  return { every, ...(every === 'week' ? { days: days!.length ? days : undefined } : {}), ...(until ? { until } : {}), ...(anchor ? { anchor } : {}) };
}

/** Does it fall due on this date? (`anchor` = the date it was first due, for weekly / monthly.) */
export function repeatsOn(iso: string, rule: RepeatRule, given: string): boolean {
  const anchor = rule.anchor || given;
  if (rule.until && iso > rule.until) return false;
  switch (rule.every) {
    case 'day': return true;
    case 'weekdays': { const w = weekday(iso); return w >= 1 && w <= 5; }
    case 'week': return (rule.days?.length ? rule.days : [weekday(anchor)]).includes(weekday(iso));
    case 'month': {
      const want = parse(anchor).getUTCDate();
      const d = parse(iso);
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      return d.getUTCDate() === Math.min(want, last);
    }
  }
}

/** The next day it's due strictly after `from` (null once past `until`). */
export function nextRepeat(from: string, rule: RepeatRule, anchor = from): string | null {
  if (!ISO.test(from)) return null;
  let d = addDays(from, 1);
  for (let i = 0; i < 400; i++, d = addDays(d, 1)) {
    if (rule.until && d > rule.until) return null;
    if (repeatsOn(d, rule, anchor)) return d;
  }
  return null;
}

/** The first day it's due on or after `today` -- a missed day rolls forward rather than sitting overdue. */
export function catchUp(due: string, today: string, rule: RepeatRule, anchor = due): string | null {
  if (!ISO.test(due) || due >= today) return due;
  return repeatsOn(today, rule, anchor) ? today : nextRepeat(today, rule, anchor);
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function repeatLabel(rule: RepeatRule | null | undefined, anchor?: string | null): string {
  if (!rule) return '';
  const base = rule.every === 'day' ? 'Every day' : rule.every === 'weekdays' ? 'Every weekday'
    : rule.every === 'week' ? `Weekly on ${(rule.days?.length ? rule.days : anchor && ISO.test(anchor) ? [weekday(anchor)] : []).map((n) => DAY[n]).join(', ') || 'the same day'}`
    : `Monthly on day ${anchor && ISO.test(anchor) ? parse(anchor).getUTCDate() : '—'}`;
  return rule.until ? `${base} until ${rule.until}` : base;
}
