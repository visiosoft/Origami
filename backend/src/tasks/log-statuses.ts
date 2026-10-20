/** A Request Log status. `closed` ones end the task: they stamp the close date and drop out of reminders. */
export interface LogStatus { name: string; closed?: boolean; color?: string }

export const LOG_STATUSES_KEY = 'requestLog.statuses';

/**
 * The task buckets (Oct 16) -- the same six as the task board: To Do, Assigned,
 * In Progress, On hold, Complete, Confirmed. Complete and Confirmed close a task.
 */
export const DEFAULT_LOG_STATUSES: LogStatus[] = [
  { name: 'To Do' }, { name: 'Assigned' }, { name: 'In Progress' }, { name: 'On hold' },
  { name: 'Complete', closed: true }, { name: 'Confirmed', closed: true },
];
/** Where a new entry starts. */
export const LOG_START = 'To Do';
/** The buckets can be recoloured and others added, but not removed. */
export const LOG_BUCKETS = DEFAULT_LOG_STATUSES.map((s) => s.name);

/** The statuses before the buckets: "Open" is To Do (or Assigned), "Closed" is Complete. */
export function bucketOf(status: string | null | undefined, hasAssignee: boolean): string | null | undefined {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'open' || s === 'not started' || s === 'to do' || s === 'todo') return hasAssignee ? 'Assigned' : 'To Do';
  if (s === 'closed' || s === 'done') return 'Complete';
  return status;
}

/** The In Progress bucket, however it's spelled. */
export const isInProgress = (status: string | null | undefined) => /^in[\s-]*progress$/i.test(String(status || '').trim());

/** A saved list from before the buckets, brought onto them: renamed, with the missing buckets added in order. */
export function withBuckets(list: LogStatus[]): LogStatus[] {
  const renamed = list.map((s) => (s.name === 'Open' ? { ...s, name: 'To Do' } : s.name === 'Closed' ? { ...s, name: 'Complete', closed: true } : s));
  const extra = renamed.filter((s) => !LOG_BUCKETS.includes(s.name));
  const buckets = DEFAULT_LOG_STATUSES.map((b) => ({ ...b, ...(renamed.find((s) => s.name === b.name)?.color ? { color: renamed.find((s) => s.name === b.name)!.color } : {}) }));
  // Extras go before Complete, where an admin's own working statuses belong.
  const at = buckets.findIndex((b) => b.name === 'Complete');
  return [...buckets.slice(0, at), ...extra, ...buckets.slice(at)];
}

const COLOR = /^#[0-9a-f]{6}$/i;

/**
 * The saved list, cleaned: unique names, at most 12, and always the six
 * buckets (Complete and Confirmed closed). Anything unusable falls back to the defaults.
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
  return withBuckets(out).slice(0, 12);
}

export const isClosedStatus = (list: LogStatus[], status?: string | null) => list.some((s) => s.closed && s.name === status);
