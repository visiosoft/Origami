/** The app-wide audit log (Oct 2026). Mirrors backend/src/audit/audit.service.ts AuditRow. */
export interface AuditChange { field: string; from: string | null; to: string | null }
export interface AuditRow {
  id: string; at: string; userId: string | null; userName: string | null; entityType: string; entityId: string | null;
  label: string | null; action: string; projectId: number | null; projectName?: string | null; changes: AuditChange[]; source: 'app' | 'finance';
}

/** "dueDate" -> "Due date", "assigneeId" -> "Assignee id". */
export const fieldLabel = (f: string) => f.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** "Stage: Design → Construction", "Name: set to Narvaes", "Notes: cleared". */
export function changeText(c: AuditChange): string {
  if (c.from == null && c.to != null) return `${fieldLabel(c.field)}: ${c.to}`;
  if (c.from != null && c.to == null) return `${fieldLabel(c.field)}: cleared (was ${c.from})`;
  return `${fieldLabel(c.field)}: ${c.from} → ${c.to}`;
}

/** One line: "Edward updated Project Narvaes Residence". */
export function headline(r: AuditRow): string {
  const what = [typeLabel(r.entityType), r.label || r.entityId].filter(Boolean).join(' ');
  // Finance's actions are verbs already ("sent", "approved", "void").
  const verb = r.source === 'finance' ? r.action.replace(/_/g, ' ') : ['created', 'updated', 'deleted'].includes(r.action) ? r.action : r.action.startsWith('removed') ? r.action + ' on' : `changed ${r.action} on`;
  return `${r.userName || 'Someone'} ${verb} ${what}`.trim();
}

/** The log as CSV rows. */
export function auditCsvRows(rows: AuditRow[]) {
  return rows.map((r) => ({
    at: r.at, who: r.userName || '', type: typeLabel(r.entityType), record: r.label || r.entityId || '', action: r.action,
    project: r.projectName || '', changes: r.changes.map(changeText).join('; '),
  }));
}

/** The record types present, for the filter. */
/** What a stored type is called now: the Request Log was renamed the Special Actions Log (Oct 27). */
export const typeLabel = (t: string) => (t === 'Request Log task' ? 'Special Actions Log task' : t);

export const typesIn = (rows: AuditRow[]) => [...new Set(rows.map((r) => r.entityType))].sort();
