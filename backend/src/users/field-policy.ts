/**
 * Field roles and money (Nov 10 sync): Edward restricted superintendents from
 * financials, estimates and CSI codes. Superintendents, foremen and labour keep
 * only what they enter themselves -- reimbursables, timesheets, projected
 * labour -- and see, but don't change, People and Projects.
 */
export const FIELD_ROLE_KEY = /super|foreman|labou?r|site_/i;

/** Money they still need: their own entries. */
export const FIELD_KEEP = new Set(['fin:reimbursables', 'fin:projected_labor', 'fin:timesheets', 'fin:timesheet_paid_due_overdue']);
/** Off entirely: estimates and the finance modules (CSI codes are edited under Financial & Resource). */
export const FIELD_OFF = new Set(['estimating', 'estimating_history', 'fin_project', 'fin_business', 'fin_resources', 'changeorders_approve']);
/** Seen, not changed. */
export const FIELD_VIEW_ONLY = new Set(['people', 'projects', 'pipeline', 'crm_holding']);

type Perm = { view?: boolean; manage?: boolean; [k: string]: unknown };
export interface PolicyChange { key: string; from: string; to: string }
const label = (p?: Perm) => (p?.manage ? 'view + change' : p?.view ? 'view' : 'off');

/** What the policy would change on one role's permissions (and the result). */
export function fieldPolicy(perms: Record<string, Perm>): { next: Record<string, Perm>; changes: PolicyChange[] } {
  const next: Record<string, Perm> = {};
  const changes: PolicyChange[] = [];
  for (const [key, p] of Object.entries(perms || {})) {
    let to: Perm = p;
    if ((key.startsWith('fin:') && !FIELD_KEEP.has(key)) || FIELD_OFF.has(key)) {
      if (p?.view || p?.manage) to = { ...p, view: false, manage: false };
    } else if (FIELD_VIEW_ONLY.has(key) && p?.manage) {
      to = { ...p, manage: false };
    }
    next[key] = to;
    if (label(p) !== label(to)) changes.push({ key, from: label(p), to: label(to) });
  }
  return { next, changes };
}

/** Is this a field role, by its key or its name? */
export const isFieldRole = (r: { key: string; name?: string | null }) => FIELD_ROLE_KEY.test(r.key) || FIELD_ROLE_KEY.test(String(r.name || ''));
