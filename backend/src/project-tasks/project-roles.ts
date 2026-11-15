/**
 * Role-based task assignment (Nov 13, Batch 4). A task is given to a role --
 * the programme's "team" (Project Manager, Architect, Admin...) -- and the
 * project's team says who fills each role, so the person fills in on their
 * own. One list for the three ways roles are named today: the programme's
 * team names, the CRM's role keys (projectManager...) and the access roles
 * ("Internal Project Manager"). Keep frontend/src/data/projectRoles.ts the
 * same (a test checks).
 */
export const PROJECT_ROLES: { key: string; label: string; names: string[] }[] = [
  { key: 'projectManager', label: 'Project Manager', names: ['project manager', 'pm', 'internal project manager', 'construction manager', 'internal construction manager'] },
  { key: 'projectCoordinator', label: 'Project Coordinator', names: ['project coordinator', 'pc', 'internal project coordinator', 'coordinator'] },
  { key: 'estimator', label: 'Estimator', names: ['estimator', 'internal estimator', 'estimating'] },
  { key: 'architect', label: 'Architect', names: ['architect', 'internal architect', 'drafting', 'drafter'] },
  { key: 'designer', label: 'Designer', names: ['designer', 'interior design', 'interior designer', 'design'] },
  { key: 'superintendent', label: 'Superintendent', names: ['superintendent', 'super', 'internal super', 'site superintendent'] },
  { key: 'foreman', label: 'Foreman', names: ['foreman', 'internal foreman lead', 'foreman lead'] },
  { key: 'admin', label: 'Admin', names: ['admin', 'administration', 'office admin', 'internal administrator'] },
  { key: 'accounting', label: 'Accounting', names: ['accounting', 'internal accounting', 'bookkeeper'] },
  { key: 'permits', label: 'Permits & Compliance', names: ['permits & compliance', 'permits', 'permitting', 'compliance'] },
];

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** The project role a task's team means, or null (Client, Automation, a free-text team...). */
export function roleKeyOf(team: unknown): string | null {
  const t = norm(team);
  if (!t) return null;
  return PROJECT_ROLES.find((r) => norm(r.key) === t || norm(r.label) === t || r.names.includes(t))?.key ?? null;
}

export const roleLabel = (key: string) => PROJECT_ROLES.find((r) => r.key === key)?.label || key;

interface TaskLike { team?: string | null; assignee?: string | null; assigneeId?: string | null; completed?: boolean | null; status?: string | null }

/**
 * Tasks given to a role but to nobody yet get the person who fills that role
 * on the project. A person picked by hand is never changed; done tasks are
 * left alone. Returns the tasks it changed.
 */
export function fillByRole<T extends TaskLike>(tasks: T[], roles: Record<string, string> | null | undefined, nameOf: (userId: string) => string | null): T[] {
  const out: T[] = [];
  for (const t of tasks) {
    if (t.assigneeId || (t.assignee || '').trim() || t.completed || t.status === 'Done') continue;
    const key = roleKeyOf(t.team);
    const userId = key ? (roles || {})[key] : '';
    const name = userId ? nameOf(userId) : null;
    if (!userId || !name) continue;
    t.assigneeId = userId; t.assignee = name;
    out.push(t);
  }
  return out;
}

/** For the project's Team card: per role, who fills it and how many open tasks wait on it while it's empty. */
export function roleSummary(tasks: TaskLike[], roles: Record<string, string> | null | undefined) {
  return PROJECT_ROLES.map((r) => {
    const waiting = tasks.filter((t) => roleKeyOf(t.team) === r.key && !t.assigneeId && !(t.assignee || '').trim() && !t.completed && t.status !== 'Done').length;
    return { key: r.key, label: r.label, userId: (roles || {})[r.key] || null, waiting };
  });
}
