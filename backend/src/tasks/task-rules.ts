/**
 * Task rules shared by the board and the Request Log (Oct 20 sync):
 * - a start date that has arrived moves an assigned task to In Progress;
 * - nothing goes In Progress without an assignee;
 * - marking a task complete needs a note saying what was done.
 */

export const todayISO = () => new Date().toISOString().slice(0, 10);

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
