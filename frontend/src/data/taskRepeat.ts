/**
 * Nov 27 (Weekly Sync): a task that repeats like a calendar invite -- one
 * task, its due date moving on each time it's done. Mirrors backend
 * database/task-repeat.ts (the server works out the next date).
 */
export type RepeatEvery = 'day' | 'weekdays' | 'week' | 'month';
export interface RepeatRule { every: RepeatEvery; days?: number[]; until?: string | null; anchor?: string | null }

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const weekdayOf = (iso: string) => new Date(iso + 'T12:00:00').getDay();

export function repeatLabel(rule: RepeatRule | null | undefined, due?: string | null): string {
  if (!rule) return '';
  const anchor = rule.anchor || due || '';
  const base = rule.every === 'day' ? 'Every day' : rule.every === 'weekdays' ? 'Every weekday'
    : rule.every === 'week' ? `Weekly on ${(rule.days?.length ? rule.days : ISO.test(anchor) ? [weekdayOf(anchor)] : []).map((n) => DAY[n]).join(', ') || 'the same day'}`
    : `Monthly on day ${ISO.test(anchor) ? Number(anchor.slice(8)) : '—'}`;
  return rule.until ? `${base} until ${rule.until}` : base;
}
export const REPEAT_DAYS = DAY;
