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
 * Nov 27 (Weekly Sync, "tick = who sees it"): a file's audience is any
 * combination of Internal, Client and External. Stored in the same short
 * column as "+" and the first letters ("+ic" = Internal + Client); the
 * older single words keep their meaning -- Client = our team and the client,
 * External = everyone on the project, Internal / empty = our team.
 */
export function fileAudience(v: unknown): FileAccess[] {
  const s = String(v ?? '').trim().toLowerCase();
  if (s.startsWith('+')) {
    const out = FILE_ACCESS.filter((a) => s.slice(1).includes(a[0]));
    return out.length ? out : ['internal'];
  }
  if (s === 'external') return ['internal', 'client', 'external'];
  if (s === 'client') return ['internal', 'client'];
  return ['internal'];
}
export function encodeAudience(list: unknown): string {
  const raw = (Array.isArray(list) ? list : [list]).map((x) => String(x || '').trim().toLowerCase());
  const picked = FILE_ACCESS.filter((a) => raw.includes(a));
  if (!picked.length) throw new Error('Pick who sees it: Internal, Client and/or External.');
  return '+' + picked.map((a) => a[0]).join('');
}

/**
 * May this viewer see a file with this tag? Staff see everything; a client
 * sees it when it's ticked Client; consultants, trades and guests when it's
 * ticked External.
 */
export function fileAccessOk(v: { staff: boolean; manager?: boolean; tier?: string }, access: unknown): boolean {
  if (v.staff || v.manager) return true;
  return fileAudience(access).includes(v.tier === 'client' ? 'client' : 'external');
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
