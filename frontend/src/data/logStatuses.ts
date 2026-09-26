import { useEffect, useState } from 'react';
import { api } from '../api';

/** A Request Log status. `closed` ones end the task (close date stamped, out of reminders and "open" counts). */
export interface LogStatus { name: string; closed?: boolean; color?: string }

export const DEFAULT_LOG_STATUSES: LogStatus[] = [
  { name: 'Open' }, { name: 'In Progress' }, { name: 'On hold' }, { name: 'Closed', closed: true },
];

const TONES: Record<string, { bg: string; c: string }> = {
  Closed: { bg: '#D2EAD3', c: '#1C5230' },
  Open: { bg: '#F2DFD4', c: '#8E2E0A' },
  'In Progress': { bg: '#D6E8E5', c: '#2F6F68' },
  'On hold': { bg: '#FBE9AE', c: '#93520F' },
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

/** A Request Log task is done when its status is one marked closed ("Closed" always counts). */
export const isLogClosed = (status?: string | null) => status === 'Closed' || current.some((s) => s.closed && s.name === status);

/** Badge colours for a status: the built-in ones, an admin's chosen colour, or neutral. */
export function logStatusTone(name?: string | null): { bg: string; c: string } {
  if (name && TONES[name]) return TONES[name];
  const custom = current.find((s) => s.name === name)?.color;
  if (custom) return { bg: custom + '22', c: custom };
  return isLogClosed(name) ? TONES.Closed : { bg: '#EFEDE8', c: '#5C6B65' };
}
