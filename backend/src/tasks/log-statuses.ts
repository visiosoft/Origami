/** A Request Log status. `closed` ones end the task: they stamp the close date and drop out of reminders. */
export interface LogStatus { name: string; closed?: boolean; color?: string }

export const LOG_STATUSES_KEY = 'requestLog.statuses';

/** The Request Log's statuses until an administrator changes them -- "On hold" matches the task board's. */
export const DEFAULT_LOG_STATUSES: LogStatus[] = [
  { name: 'Open' }, { name: 'In Progress' }, { name: 'On hold' }, { name: 'Closed', closed: true },
];

const COLOR = /^#[0-9a-f]{6}$/i;

/**
 * The saved list, cleaned: unique names, at most 12, and always an "Open"
 * (new tasks start there) and at least one closed status ("Closed" if none
 * was marked). Anything unusable falls back to the defaults.
 */
export function parseLogStatuses(raw: unknown): LogStatus[] {
  let list: unknown = raw;
  if (typeof raw === 'string') { try { list = raw.trim() ? JSON.parse(raw) : null; } catch { list = null; } }
  if (!Array.isArray(list)) return DEFAULT_LOG_STATUSES;
  const seen = new Set<string>();
  const out: LogStatus[] = [];
  for (const s of list) {
    const name = String((s as any)?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 30);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const color = String((s as any)?.color || '');
    out.push({ name, ...((s as any)?.closed ? { closed: true } : {}), ...(COLOR.test(color) ? { color } : {}) });
    if (out.length >= 12) break;
  }
  if (!out.length) return DEFAULT_LOG_STATUSES;
  if (!out.some((s) => s.name === 'Open')) out.unshift({ name: 'Open' });
  if (!out.some((s) => s.closed)) {
    const c = out.find((s) => s.name === 'Closed');
    if (c) c.closed = true; else out.push({ name: 'Closed', closed: true });
  }
  return out;
}

export const isClosedStatus = (list: LogStatus[], status?: string | null) => list.some((s) => s.closed && s.name === status);
