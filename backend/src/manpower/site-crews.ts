/**
 * Site crews (Nov 17 sync, Astrid / Edward): on each project, each field
 * worker reports to a supervisor (employee_assignments.supervisorId). A
 * supervisor -- a field role without Manpower "manage" -- sees and reports on
 * only his own crew; the office (admins, PMs, Manpower managers) sees everyone.
 */
const FIELD_ROLE = /super|foreman|labou?r|site_/i;

export interface CrewViewer { sub: string; roleKey: string; tier?: string }
export type Perms = Record<string, { view?: boolean; manage?: boolean } | undefined> | null | undefined;

/** Limited to his own crew? Field roles without Manpower manage rights. */
export function crewLimited(v: CrewViewer | null | undefined, perms: Perms): boolean {
  if (!v || v.roleKey === 'admin') return false;
  if (!FIELD_ROLE.test(String(v.roleKey || ''))) return false;
  return !(perms?.manpower_con?.manage || perms?.manpower_build?.manage);
}

interface Assign { employeeId: string; projectId: number; supervisorId?: string | null; status?: string; endDate?: string | null }
const open = (a: Assign, on: string) => a.status !== 'ended' && (!a.endDate || String(a.endDate).slice(0, 10) >= on);

/** The workers who report to this supervisor (on one project, or on any). */
export function crewOf(assignments: Assign[], supervisorId: string, today: string, projectId?: number): Set<string> {
  return new Set(assignments.filter((a) => a.supervisorId === supervisorId && open(a, today) && (projectId == null || Number(a.projectId) === Number(projectId))).map((a) => a.employeeId));
}

/** A supervisor's report may only list his crew: the names of any who aren't. */
export function outsideCrew(entries: { employeeId?: string }[], crew: Set<string>, nameOf: (id: string) => string): string[] {
  return [...new Set(entries.map((e) => String(e.employeeId || '')).filter((id) => id && !crew.has(id)))].map(nameOf);
}
