/**
 * Task rules shared by the board and the Request Log (Oct 20 sync):
 * - a start date that has arrived moves an assigned task to In Progress;
 * - nothing goes In Progress without an assignee;
 * - marking a task complete needs a note saying what was done;
 * - putting a task on hold needs a reason (Oct 27 backlog: "On Hold = blocked, reason required").
 */

import { localToday } from '../common/local-date';

/** The company's day (Nov 17: not UTC). */
export const todayISO = () => localToday();

/** A start date on or before today, on an assigned task that hasn't started: time to start it. */
export function startDue(startDate: string | null | undefined, assigned: boolean, today = todayISO()) {
  const d = String(startDate || '').slice(0, 10);
  return assigned && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today;
}

/** A completion note, trimmed and capped; '' when there isn't one. */
export function cleanCompletionNote(v: unknown) {
  return typeof v === 'string' ? v.trim().slice(0, 4000) : '';
}

export const NO_ASSIGNEE_IN_PROGRESS = 'Assign someone before moving this to In Progress.';
export const NEEDS_COMPLETION_NOTE = 'Add a note saying what was done before marking this complete.';
export const NEEDS_HOLD_REASON = 'Say why it is on hold before putting it on hold.';

const isHold = (s: unknown) => /^on[\s-]*hold$/i.test(String(s || '').trim());

/**
 * Whether a save would leave a task on hold with no reason: moving it to On
 * hold without one, or clearing the reason while it stays on hold.
 */
export function holdReasonMissing(before: { status?: string | null; holdReason?: string | null }, patch: { status?: string | null; holdReason?: string | null }) {
  const next = patch.status ?? before.status;
  if (!isHold(next)) return false;
  const reason = 'holdReason' in patch ? patch.holdReason : before.holdReason;
  return !String(reason ?? '').trim();
}

export const NEEDS_DUE_REASON = 'This task is overdue: say why the due date is changing (e.g. client hold) before moving or clearing it.';

/**
 * Nov 17 sync (Astrid): an overdue task's due date can still be moved or
 * cleared, but only with a reason -- client hold, waiting on others -- so the
 * compliance record shows why. `open` is false for finished or closed tasks.
 */
export function dueChangeReasonMissing(
  before: { dueDate?: string | null },
  patch: { dueDate?: string | null; dueReason?: string | null },
  open: boolean,
  today = todayISO(),
) {
  if (!open || !('dueDate' in patch)) return false;
  const was = String(before.dueDate || '').slice(0, 10);
  const next = String(patch.dueDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(was) || was >= today || next === was) return false;
  return !String(patch.dueReason || '').trim();
}

/** The history line for a due date moved with a reason. */
export function dueChangeNote(was: string | null | undefined, next: string | null | undefined, reason: string) {
  return `Due date ${was ? String(was).slice(0, 10) : 'none'} → ${next ? String(next).slice(0, 10) : 'none'}. Reason: ${reason.trim().slice(0, 500)}`;
}
