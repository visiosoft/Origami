/**
 * A meeting's status:
 *  - scheduled   — on the calendar
 *  - occurred    — it happened, but no one has gone through it for special actions yet
 *  - cancelled
 *  - rescheduled — moved; the date on it is the new one
 *  - reviewed    — someone went through the notes / transcript and pulled out the
 *                  special actions and FOR RECORD items
 *  - complete    — set automatically: reviewed, and every special action captured
 *                  from it is completed, cancelled or archived
 */
export const MEETING_STATUSES = ['scheduled', 'occurred', 'cancelled', 'rescheduled', 'reviewed', 'complete'] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

/** How a meeting is held. In-person meetings keep their address in `location`. */
export const MEETING_LOCATION_TYPES = ['virtual', 'call', 'text', 'in_person'] as const;

/** Older and loosely-typed values, mapped onto the current set. */
const ALIASES: Record<string, MeetingStatus> = {
  held: 'occurred', happened: 'occurred', done: 'occurred',
  canceled: 'cancelled', postponed: 'rescheduled', completed: 'complete',
};

/** Any stored status -> one of MEETING_STATUSES ("held" -> "occurred"; unknown or empty -> "scheduled"). */
export function normalizeMeetingStatus(raw?: string | null): MeetingStatus {
  const s = String(raw || '').trim().toLowerCase();
  if ((MEETING_STATUSES as readonly string[]).includes(s)) return s as MeetingStatus;
  return ALIASES[s] || 'scheduled';
}

/** One special action captured from a meeting, as far as completion goes. */
export interface CapturedAction {
  kind: 'task' | 'rfi' | 'changeOrder';
  status?: string | null;
}

const TASK_DONE = /^(closed|done|complete|completed|cancell?ed|archived|void)$/i;
const RFI_DONE = ['closed', 'void', 'cancelled', 'archived'];
const CO_DONE = ['approved', 'rejected', 'cancelled', 'void', 'archived'];

/**
 * Whether an action is finished: a Request Log entry in a closed status (as set in
 * Settings) or named done / cancelled / archived; an RFI closed or void; a change
 * order approved, rejected or cancelled.
 */
export function isActionDone(a: CapturedAction, closedTaskStatuses: string[] = ['Closed']): boolean {
  const st = String(a.status || '').trim();
  if (a.kind === 'task') return closedTaskStatuses.includes(st) || TASK_DONE.test(st);
  if (a.kind === 'rfi') return RFI_DONE.includes(st.toLowerCase());
  return CO_DONE.includes(st.toLowerCase());
}

/**
 * The status a meeting should have given what was captured from it: a reviewed
 * meeting whose captured actions are all done becomes complete; a complete one
 * whose actions are reopened (or added to) goes back to reviewed. Every other
 * status is left as it is -- only a reviewer decides a meeting was reviewed.
 * A meeting that produced no actions keeps whichever of the two a person chose.
 */
export function settleMeetingStatus(raw: string | null | undefined, actions: CapturedAction[], closedTaskStatuses?: string[]): MeetingStatus {
  const status = normalizeMeetingStatus(raw);
  if ((status !== 'reviewed' && status !== 'complete') || !actions.length) return status;
  const allDone = actions.every((a) => isActionDone(a, closedTaskStatuses));
  return allDone ? 'complete' : 'reviewed';
}
