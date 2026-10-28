import { pageArgs, pageOf, sortRows } from '../common/paging';

/**
 * The RFI log's filters, worked out on the server so the page gets one page
 * at a time, plus the counts and stat cards (which cover every RFI, not just
 * the page). Mirrors frontend/src/components/rfis/Rfis.tsx.
 */
type R = Record<string, any>;

/** Days since it was sent (to the answer, or today). */
export function daysOpen(r: R, today: string): number | null {
  if (!r.dateSent) return null;
  const end = r.dateAnswered || (r.status === 'open' ? today : r.dateClosed || today);
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(r.dateSent)) / 86400000));
}
export const isOverdue = (r: R, today: string) => r.status === 'open' && !!r.dateDue && r.dateDue < today;

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', open: 'Open', answered: 'Answered', closed: 'Closed', void: 'Void' };

export interface RfiQuery { status?: string; q?: string; sort?: string; dir?: 'asc' | 'desc'; page?: unknown; size?: unknown; today: string }

export function queryRfis(all: R[], o: RfiQuery) {
  const status = o.status || 'active';
  const t = String(o.q || '').trim().toLowerCase();
  const shown = all
    .filter((r) => (status === 'all' ? true : status === 'active' ? r.status !== 'closed' && r.status !== 'void' : r.status === status))
    .filter((r) => !t || [r.number, r.subject, r.to?.name, r.to?.company, r.projectName, r.drawingRef, r.discipline].some((x) => String(x || '').toLowerCase().includes(t)));
  const by: Record<string, (r: R) => string | number | null | undefined> = {
    number: (r) => r.number, subject: (r) => r.subject, project: (r) => r.projectName, to: (r) => r.to?.name, status: (r) => STATUS_LABEL[r.status] || r.status,
    sent: (r) => r.dateSent, due: (r) => r.dateDue, days: (r) => daysOpen(r, o.today), ball: (r) => r.ballInCourt,
  };
  const sorted = sortRows(shown, o.sort ? by[o.sort] : undefined, o.dir);
  const live = all.filter((r) => r.status !== 'void');
  const days = live.map((r) => daysOpen(r, o.today)).filter((d): d is number => d != null);
  return {
    ...pageOf(sorted, pageArgs(o.page, o.size)),
    any: all.length > 0,
    counts: {
      open: all.filter((r) => r.status === 'open').length,
      overdue: all.filter((r) => isOverdue(r, o.today)).length,
      answered: all.filter((r) => r.status === 'answered').length,
    },
    stats: {
      draft: live.filter((r) => r.status === 'draft').length,
      avg: days.length ? Math.round(days.reduce((a, d) => a + d, 0) / days.length) : null,
      cost: live.filter((r) => r.costImpact === 'yes' && r.status !== 'closed').length,
      closed: live.filter((r) => r.status === 'closed').length,
    },
  };
}
