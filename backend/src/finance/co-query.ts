import { pageArgs, pageOf, sortRows } from '../common/paging';

/** The change order log's filters on the server, with the summary cards for every change order. */
type C = Record<string, any>;
const REASON_LABEL: Record<string, string> = {
  client_request: 'Client request', design_change: 'Design change', unforeseen: 'Unforeseen condition', scope_addition: 'Added scope',
  scope_reduction: 'Reduced scope', allowance: 'Allowance adjustment', code_requirement: 'Code / permit requirement', other: 'Other',
};
const PENDING = ['draft', 'internal_review'];

export function queryChangeOrders(all: C[], q: Record<string, string>) {
  const status = q.status || 'all';
  const text = String(q.q || '').trim().toLowerCase();
  const shown = all.filter((c) => (status === 'all' || (status === 'pending' ? PENDING.includes(c.status) : c.status === status))
    && (!text || `${c.number} ${c.title} ${c.projectName || ''}`.toLowerCase().includes(text)));
  const by: Record<string, (c: C) => string | number | null | undefined> = {
    number: (c) => c.number, project: (c) => c.projectName, title: (c) => c.title, reason: (c) => REASON_LABEL[c.reason] || c.reason, amount: (c) => c.total,
    requested: (c) => c.dateRequested, days: (c) => c.scheduleImpactDays, status: (c) => c.status,
  };
  const sorted = sortRows(shown, q.sort ? by[q.sort] : undefined, q.dir === 'desc' ? 'desc' : 'asc');
  const sum = (pred: (c: C) => boolean) => {
    const list = all.filter(pred);
    return { total: Math.round(list.reduce((a, c) => a + (Number(c.total) || 0), 0) * 100) / 100, count: list.length };
  };
  return {
    ...pageOf(sorted, pageArgs(q.page, q.size)),
    any: all.length > 0,
    summary: {
      pending: sum((c) => PENDING.includes(c.status)),
      submitted: sum((c) => c.status === 'submitted'),
      approved: sum((c) => c.status === 'approved'),
      closed: sum((c) => c.status === 'rejected' || c.status === 'cancelled'),
    },
  };
}
