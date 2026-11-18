import { rfiBuckets, type Me as RfiMe, type RfiLike } from '../rfis/rfi-alerts';

/**
 * Nov 17 sync: a "Today" panel on the dashboard -- what needs me today:
 * my Emergency / Urgent tasks, my tasks due today or overdue, and my RFIs
 * (whose turn it is, due in the next two days, or past due).
 */
type T = Record<string, any>;
export interface TodayRow { key: string; title: string; context: string; due?: string; priority?: string; tag: 'emergency' | 'urgent' | 'overdue' | 'today'; to: string }

const URGENT = ['Emergency', 'Urgent'];

export function todayPanel(board: T[], log: T[], rfis: RfiLike[], me: RfiMe & { name?: string }, opts: { today: string; projectName: (id: number | null) => string; logClosed: (s?: string) => boolean }) {
  const norm = (s?: string) => String(s || '').trim().toLowerCase();
  const isMine = (id?: string, name?: string) => (id ? id === me.id : !!me.name && !!name && norm(name) === norm(me.name));
  const tagOf = (priority?: string, due?: string): TodayRow['tag'] | null => {
    if (priority === 'Emergency') return 'emergency';
    if (priority === 'Urgent') return 'urgent';
    const d = String(due || '').slice(0, 10);
    if (d && d < opts.today) return 'overdue';
    if (d === opts.today) return 'today';
    return null;
  };
  const rows: TodayRow[] = [];
  for (const t of board) {
    if (t.completed || t.status === 'Done' || t.status === 'Confirmed' || t.archivedAt || !isMine(t.assigneeId, t.assignee)) continue;
    const tag = tagOf(t.priority, t.dueDate);
    if (tag) rows.push({ key: 'b' + t.id, title: t.title, context: opts.projectName(t.projectId ?? null), due: t.dueDate || undefined, priority: t.priority || undefined, tag, to: `/tasks?task=${encodeURIComponent(t.id)}&project=${t.projectId ?? 'null'}` });
  }
  for (const t of log) {
    if (opts.logClosed(t.status) || t.archivedAt || !isMine(t.assignedToId, t.assignedTo)) continue;
    const tag = tagOf(t.priority, t.dueDate);
    const title = String(t.subject || String(t.description || '').split('\n')[0] || t.id).slice(0, 90);
    if (tag) rows.push({ key: 'l' + t.id, title, context: t.project || 'Special Actions Log', due: t.dueDate || undefined, priority: t.priority || undefined, tag, to: `/tasks?task=${encodeURIComponent(t.id)}&type=log` });
  }
  const order = { emergency: 0, urgent: 1, overdue: 2, today: 3 } as const;
  rows.sort((a, b) => order[a.tag] - order[b.tag] || String(a.due || '9999').localeCompare(String(b.due || '9999')));
  const b = rfiBuckets(rfis, me, opts.today);
  const rfiRow = (r: RfiLike) => ({ id: r.id, number: r.number, subject: r.subject || '', due: r.dateDue || null, status: r.status, to: `/rfis?rfi=${encodeURIComponent(r.id)}` });
  return {
    tasks: rows.slice(0, 12), taskCount: rows.length,
    rfis: { mine: b.mine.map(rfiRow), dueSoon: b.dueSoon.map(rfiRow), overdue: b.overdue.map(rfiRow) },
  };
}
export { URGENT };
