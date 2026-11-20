import { UnauthorizedException } from '@nestjs/common';
import { internalOnly } from './task.types';
import type { SessionClaims } from '../auth/crypto.util';

/**
 * Who may see which tasks.
 *
 * Internal staff see the whole project (the client filters their own view down
 * to "my tasks" by default, but that's a preference). Clients and consultants
 * are restricted to work actually assigned to them, and that restriction is
 * applied here rather than in the browser — otherwise dropping the filter, or
 * calling the API directly, would expose the internal board.
 */

/** Tiers that may only ever see their own tasks. */
const RESTRICTED_TIERS = ['client', 'consultant'];

export function isRestrictedViewer(claims: SessionClaims): boolean {
  if (claims.roleKey === 'admin') return false;
  return RESTRICTED_TIERS.includes(claims.tier);
}

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

/** Whether a task belongs to this viewer, by id with a name fallback. */
export function assignedTo(
  task: { assigneeId?: string; assignee?: string; assignedToId?: string; assignedTo?: string; collaborators?: { id: string }[] | null },
  claims: SessionClaims,
): boolean {
  if ((task.collaborators || []).some((c) => c?.id === claims.sub)) return true;
  const id = task.assigneeId ?? task.assignedToId;
  if (id) return id === claims.sub;
  const name = task.assignee ?? task.assignedTo;
  return !!name && norm(name) === norm(claims.name);
}

/**
 * Narrow a task list to what the caller is allowed to see.
 *
 * A valid session is required: without one we cannot tell a client from a
 * member of staff, and answering anonymously would make the restriction
 * trivially avoidable by simply omitting the token.
 */
export function scopeTasks<T extends Record<string, any>>(tasks: T[], claims: SessionClaims | null): T[] {
  if (!claims) throw new UnauthorizedException('Sign in to view tasks.');
  if (!isRestrictedViewer(claims)) return tasks;
  // Internal or Financial items stay with our own team even when assigned out.
  const ok = (t: T) => !internalOnly(t.tags);
  const mine = tasks.filter((t) => assignedTo(t, claims) && ok(t));
  // Nov 17 (subtask visibility): someone on a parent task sees its subtasks; someone on only a subtask
  // sees its parent's title, so "Subtask of ..." makes sense -- nothing else of it.
  const ids = new Set(mine.map((t) => t.id));
  const children = tasks.filter((t) => t.parentId && ids.has(t.parentId) && !ids.has(t.id) && ok(t));
  for (const c of children) ids.add(c.id);
  const parents = [...new Set(mine.map((t) => t.parentId).filter((p) => p && !ids.has(p)))]
    .map((pid) => tasks.find((t) => t.id === pid))
    .filter((p): p is T => !!p && ok(p))
    .map((p) => ({ id: p.id, title: p.title, projectId: p.projectId, sectionId: p.sectionId, status: p.status, completed: p.completed, parentId: null, contextOnly: true }) as unknown as T);
  return [...mine, ...children, ...parents];
}

/**
 * Staff on "Assigned projects" (Oct 30 sync): a Special Actions entry is
 * theirs to see when it's on one of their projects, or when it's assigned to
 * them, shared with them or raised by them (Nov 20: on any project).
 */
export function onMyProjects<T extends Record<string, any>>(rows: T[], allowed: 'all' | Set<string>, claims: SessionClaims): T[] {
  if (allowed === 'all') return rows;
  return rows.filter((t) => {
    const project = String(t.project || '').trim();
    if (project && allowed.has(project)) return true;
    // Nov 20: a task given to someone (or shared with / raised by them) is theirs to see, even on a project they aren't on.
    return assignedTo(t, claims) || t.createdById === claims.sub;
  });
}
