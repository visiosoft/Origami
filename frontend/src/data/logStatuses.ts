import { tint } from '../theme';
import { useEffect, useState } from 'react';
import { api } from '../api';

/** A Request Log status. `closed` ones end the task (close date stamped, out of reminders and "open" counts). */
export interface LogStatus { name: string; closed?: boolean; color?: string }

/** The task buckets, the same as the task board's. Complete and Confirmed close a task. */
export const DEFAULT_LOG_STATUSES: LogStatus[] = [
  { name: 'To Do' }, { name: 'Assigned' }, { name: 'In Progress' }, { name: 'On hold' },
  { name: 'Complete', closed: true }, { name: 'Confirmed', closed: true },
];
/** The buckets stay in the list (they can be recoloured, not renamed or removed). */
export const LOG_BUCKETS = DEFAULT_LOG_STATUSES.map((s) => s.name);

const TONES: Record<string, { bg: string; c: string }> = {
  'To Do': { bg: '#F2DFD4', c: '#8E2E0A' },
  Assigned: { bg: '#E3E0F5', c: '#4B3F8F' },
  'In Progress': { bg: '#D6E8E5', c: '#2F6F68' },
  'On hold': { bg: 'var(--amber-light)', c: '#93520F' },
  Complete: { bg: 'var(--c-d2ead3)', c: 'var(--success-deep)' },
  Confirmed: { bg: '#1E6B36', c: '#fff' },
  // From before the buckets.
  Closed: { bg: 'var(--c-d2ead3)', c: 'var(--success-deep)' },
  Open: { bg: '#F2DFD4', c: '#8E2E0A' },
};

// One copy for the whole app, loaded once and shared by every screen.
let current: LogStatus[] = DEFAULT_LOG_STATUSES;
let pending: Promise<LogStatus[]> | null = null;
const listeners = new Set<(l: LogStatus[]) => void>();
const publish = (l: LogStatus[]) => { current = l; listeners.forEach((f) => f(l)); };

export function loadLogStatuses(force = false): Promise<LogStatus[]> {
  if (!pending || force) {
    pending = api.tasks.statuses()
      .then((l) => { const list = Array.isArray(l) && l.length ? (l as LogStatus[]) : DEFAULT_LOG_STATUSES; publish(list); return list; })
      .catch(() => current);
  }
  return pending;
}
/** After Settings saves a new list. */
export const setLogStatuses = (l: LogStatus[]) => { pending = Promise.resolve(l); publish(l); };

/** The Request Log's statuses, as set in Settings (the defaults until they load). */
export function useLogStatuses() {
  const [list, setList] = useState<LogStatus[]>(current);
  useEffect(() => {
    listeners.add(setList);
    void loadLogStatuses();
    return () => { listeners.delete(setList); };
  }, []);
  return list;
}

/** A Request Log task is done when its status is one marked closed (Complete, Confirmed, and the old "Closed"). */
export const isLogClosed = (status?: string | null) => status === 'Closed' || status === 'Complete' || status === 'Confirmed' || current.some((s) => s.closed && s.name === status);

/** Badge colours for a status: the built-in ones, an admin's chosen colour, or neutral. */
export function logStatusTone(name?: string | null): { bg: string; c: string } {
  if (name && TONES[name]) return TONES[name];
  const custom = current.find((s) => s.name === name)?.color;
  if (custom) return { bg: tint(custom, '22'), c: custom };
  return isLogClosed(name) ? TONES.Closed : { bg: 'var(--c-efede8)', c: 'var(--c-5c6b65)' };
}
