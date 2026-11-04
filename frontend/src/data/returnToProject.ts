/**
 * Back to the project you were in (Nov 3 sync: opening something from a
 * project -- the CRM lead, daily reports, the File Room, a task -- left the
 * project behind, and Back landed on a closed drawer). While a project's
 * drawer is open its place is kept here; other pages offer a way back.
 */
export interface ProjectPlace { path: string; label: string; at: number }
const KEY = 'origami.returnToProject';
const MAX_AGE = 4 * 3600_000;

export function rememberProjectPlace(id: number, name: string, tab: string, view?: string) {
  const q = new URLSearchParams({ open: String(id), tab });
  if (view && tab === 'tasks') q.set('view', view);
  try { sessionStorage.setItem(KEY, JSON.stringify({ path: `/projects?${q}`, label: name, at: Date.now() } satisfies ProjectPlace)); } catch { /* private mode */ }
}
export function forgetProjectPlace() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
/** The project to go back to, if one was open recently. */
export function projectPlace(): ProjectPlace | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || 'null') as ProjectPlace | null;
    return v && v.path?.startsWith('/projects?') && Date.now() - v.at < MAX_AGE ? v : null;
  } catch { return null; }
}
