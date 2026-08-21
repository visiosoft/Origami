import { UnauthorizedException } from '@nestjs/common';
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
  task: { assigneeId?: string; assignee?: string; assignedToId?: string; assignedTo?: string },
  claims: SessionClaims,
): boolean {
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
  return tasks.filter((t) => assignedTo(t, claims));
}
