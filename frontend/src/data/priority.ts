import type { Priority } from './projectTasks';

/**
 * Priority and due date go together (Oct 16):
 *   Urgent — due within 24 hours          default: tomorrow
 *   High   — within 5 business days       default: 5 business days out
 *   Medium — within a month               default: 2 weeks out
 *   Low    — more than a month            default: 1 month out
 * Whichever is set first fills in the other; nothing typed by hand is overwritten.
 */
export const PRIORITY_HINT: Record<Priority, string> = {
  Urgent: 'Due within 24 hours',
  High: 'Due within 5 business days',
  Medium: 'Due within a month',
  Low: 'Due in more than a month',
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s: string) => new Date(s + 'T12:00:00');
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export function addBusinessDays(d: Date, n: number) {
  const x = new Date(d);
  let left = n;
  while (left > 0) { x.setDate(x.getDate() + 1); const wd = x.getDay(); if (wd !== 0 && wd !== 6) left--; }
  return x;
}
const addMonths = (d: Date, n: number) => { const x = new Date(d); const day = x.getDate(); x.setMonth(x.getMonth() + n); if (x.getDate() < day) x.setDate(0); return x; };
export const todayIso = () => iso(new Date());

/** The default due date for a priority, counted from `from` (today). */
export function dueForPriority(p: Priority | '' | null | undefined, from = todayIso()): string {
  const d = parse(from);
  switch (p) {
    case 'Urgent': return iso(addDays(d, 1));
    case 'High': return iso(addBusinessDays(d, 5));
    case 'Medium': return iso(addDays(d, 14));
    case 'Low': return iso(addMonths(d, 1));
    default: return '';
  }
}

/** The priority a due date falls into. */
export function priorityForDue(due: string | null | undefined, from = todayIso()): Priority | '' {
  if (!due || !/^\d{4}-\d{2}-\d{2}/.test(due)) return '';
  const d = parse(due.slice(0, 10));
  const start = parse(from);
  if (d <= addDays(start, 1)) return 'Urgent';
  if (d <= addBusinessDays(start, 5)) return 'High';
  if (d <= addMonths(start, 1)) return 'Medium';
  return 'Low';
}

/**
 * Apply a change to priority or due date, filling the other one in when it's
 * empty or was filled in automatically. `auto` says which field was auto-filled.
 */
export function linkPriorityDue(
  cur: { priority?: Priority | '' | null; dueDate?: string | null; auto?: 'priority' | 'due' | null },
  change: { priority?: Priority | ''; dueDate?: string },
  from = todayIso(),
): { priority: Priority | ''; dueDate: string; auto: 'priority' | 'due' | null } {
  let priority = (cur.priority || '') as Priority | '';
  let dueDate = cur.dueDate || '';
  let auto = cur.auto || null;
  if ('priority' in change) {
    priority = change.priority || '';
    if (auto === 'priority') auto = null; // chosen by hand now
    if ((!dueDate || auto === 'due') && priority) { dueDate = dueForPriority(priority, from); auto = 'due'; }
    if (!priority && auto === 'due') { dueDate = ''; auto = null; }
  }
  if ('dueDate' in change) {
    dueDate = change.dueDate || '';
    if (auto === 'due') auto = null;
    if ((!priority || auto === 'priority') && dueDate) { priority = priorityForDue(dueDate, from); auto = 'priority'; }
    if (!dueDate && auto === 'priority') { priority = ''; auto = null; }
  }
  return { priority, dueDate, auto };
}
