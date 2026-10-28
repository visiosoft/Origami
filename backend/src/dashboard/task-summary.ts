/**
 * The Dashboard's task figures, worked out on the server so the page gets a
 * few numbers and short lists instead of every task. Mirrors what the page
 * computed from the full lists (frontend/src/pages/Dashboard.tsx).
 */
type T = Record<string, any>;
export interface Me { id: string; name: string }

const firstLine = (s?: string) => String(s || '').replace(/\r\n/g, '\n').trim().split('\n')[0].trim();
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const logTitle = (t: T) => String(t.subject || '').trim() || firstLine(t.description) || t.id;

export function taskSummary(board: T[], log: T[], me: Me, opts: { today: string; projectName: (id: number | null) => string; logClosed: (status?: string) => boolean }) {
  const { today, projectName, logClosed } = opts;
  const boardOpen = (t: T) => !t.completed && t.status !== 'Done';
  const mineBoard = (t: T) => !!me.id && (t.assigneeId === me.id || (!!me.name && t.assignee === me.name));
  const mineLog = (t: T) => !!me.id && (t.assignedToId === me.id || (!!me.name && t.assignedTo === me.name));

  // Due today or overdue, across everyone (the "closest to slipping" strip).
  const attention = [
    ...board.filter((t) => boardOpen(t) && t.dueDate && t.dueDate <= today)
      .map((t) => ({ task: t.title, project: projectName(t.projectId ?? null), dueDate: t.dueDate })),
    ...log.filter((t) => !logClosed(t.status) && t.dueDate && t.dueDate <= today)
      .map((t) => ({ task: clip(logTitle(t), 60), project: t.project || 'General task', dueDate: t.dueDate })),
  ].sort((a, b) => Number(b.dueDate < today) - Number(a.dueDate < today) || a.dueDate.localeCompare(b.dueDate)).slice(0, 10);

  // My own tasks.
  const mine = [
    ...board.filter(mineBoard).map((t) => ({ key: 'b' + t.id, title: t.title, project: projectName(t.projectId ?? null), due: t.dueDate || undefined, open: boardOpen(t), touched: t.updatedAt || '', to: `/tasks?task=${encodeURIComponent(t.id)}&project=${t.projectId ?? 'null'}` })),
    ...log.filter(mineLog).map((t) => ({ key: 'l' + t.id, title: logTitle(t), project: t.project || 'Special Actions Log', due: t.dueDate || undefined, open: !logClosed(t.status), touched: t.updatedAt || '', to: `/tasks?task=${encodeURIComponent(t.id)}&type=log` })),
  ];
  const open = mine.filter((t) => t.open);

  // Who has what open.
  const load = new Map<string, { open: number; done: number }>();
  const tally = (who: string | undefined, isOpen: boolean) => { const k = (who || '').trim(); if (!k) return; const v = load.get(k) || { open: 0, done: 0 }; if (isOpen) v.open++; else v.done++; load.set(k, v); };
  board.forEach((t) => tally(t.assignee, boardOpen(t)));
  log.forEach((t) => tally(t.assignedTo, !logClosed(t.status)));

  const overdueByProject = new Map<number, number>();
  board.forEach((t) => { if (t.projectId != null && boardOpen(t) && t.dueDate && t.dueDate < today) overdueByProject.set(t.projectId, (overdueByProject.get(t.projectId) || 0) + 1); });

  return {
    attention,
    mine: {
      total: mine.length,
      open: open.length,
      overdue: open.filter((t) => t.due && t.due < today).length,
      today: open.filter((t) => t.due === today).length,
      latest: [...open].sort((a, b) => b.touched.localeCompare(a.touched)).slice(0, 5),
      // This week's (or any) dated ones, for the week strip -- only mine, small.
      dated: mine.filter((t) => t.due).map(({ key, title, project, due, open: o, to }) => ({ key, title, project, due, open: o, to })),
    },
    team: [...load.entries()].sort((a, b) => b[1].open - a[1].open).slice(0, 7).map(([name, v]) => ({ name, ...v })),
    overdueByProject: [...overdueByProject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}

/** "My Tasks": open work assigned to me or that I collaborate on, soonest due first. */
export function myTaskRows(board: T[], log: T[], me: Me, opts: { limit: number; projectName: (id: number | null) => string; logClosed: (status?: string) => boolean }) {
  const norm = (s?: string) => String(s || '').trim().toLowerCase();
  const isMine = (id?: string, name?: string) => (id ? id === me.id : !!me.name && !!name && norm(name) === norm(me.name));
  const following = (t: T) => !!me.id && (Array.isArray(t.collaborators) ? t.collaborators : []).some((c: any) => c?.id === me.id);
  const createdBy = (by?: string, at?: string) => {
    if (!by) return '';
    const d = at ? new Date(at) : null;
    const when = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    return `Created by ${by}${when ? ' · ' + when : ''}`;
  };
  const rows = [
    ...board.filter((t) => !t.completed && t.status !== 'Done' && (isMine(t.assigneeId, t.assignee) || following(t))).map((t) => ({
      key: 'b' + t.id,
      title: following(t) && !isMine(t.assigneeId, t.assignee) ? `${t.title} · collaborating` : t.title,
      context: [opts.projectName(t.projectId ?? null), createdBy(t.createdByName, t.createdAt)].filter(Boolean).join(' · '),
      dueDate: t.dueDate || undefined, priority: t.priority || undefined, where: 'board' as const,
      to: `/tasks?task=${encodeURIComponent(t.id)}&project=${t.projectId ?? 'null'}`,
    })),
    ...log.filter((t) => !opts.logClosed(t.status) && (isMine(t.assignedToId, t.assignedTo) || following(t))).map((t) => ({
      key: 'l' + t.id,
      title: clip(logTitle(t), 80),
      context: [t.project || 'General task', createdBy(t.originator, t.meetingDate)].filter(Boolean).join(' · '),
      dueDate: t.dueDate || undefined, priority: undefined, where: 'log' as const,
      to: `/tasks?task=${encodeURIComponent(t.id)}&type=log`,
    })),
  ].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  return { total: rows.length, rows: rows.slice(0, opts.limit) };
}
