/**
 * Restricted File Room folders (Nov 13): who may open a folder (and every
 * folder inside it). Pure, so the tree, file pages, single files, markups,
 * shares and moves all ask the same question.
 */
export interface FolderRule { projectId: number; path: string[]; audience: string; people?: { type: string; id: string; name?: string }[] | null }
export interface Viewer { sub: string; roleKey: string; staff: boolean; companies: string[]; manager: boolean; tier?: string }

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

/** Nov 17: a file's audience tag. Empty = internal. */
export const FILE_ACCESS = ['internal', 'client', 'external'] as const;
export type FileAccess = (typeof FILE_ACCESS)[number];
export const fileAccessOf = (v: unknown): FileAccess => (v === 'client' || v === 'external' ? v : 'internal');

/**
 * May this viewer see a file with this tag? Staff see everything; clients see
 * Client and External files; consultants, trades and guests only External.
 */
export function fileAccessOk(v: { staff: boolean; manager?: boolean; tier?: string }, access: unknown): boolean {
  if (v.staff || v.manager) return true;
  const a = fileAccessOf(access);
  if (a === 'external') return true;
  return a === 'client' && v.tier === 'client';
}

/** Is `path` the folder `rule.path` or inside it? */
export function covers(rulePath: string[], path: string[]) {
  return rulePath.length > 0 && rulePath.length <= path.length && rulePath.every((p, i) => norm(p) === norm(path[i]));
}

/** May this viewer open a file or folder at `path` in `projectId`? (Project access is checked separately.) */
export function folderOpen(rules: FolderRule[], v: Viewer, projectId: number, path: string[] | null | undefined): boolean {
  if (v.manager) return true;
  const p = Array.isArray(path) ? path : [];
  for (const r of rules) {
    if (Number(r.projectId) !== Number(projectId) || !covers(r.path, p)) continue;
    if (r.audience === 'internal') { if (!v.staff) return false; continue; }
    const ok = (r.people || []).some((x) =>
      (x.type === 'user' && x.id === v.sub) || (x.type === 'role' && x.id === v.roleKey) || (x.type === 'company' && v.companies.includes(norm(x.id))));
    if (!ok) return false;
  }
  return true;
}
