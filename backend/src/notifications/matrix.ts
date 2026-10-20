/**
 * Notification settings (slide 56, Oct 20 sync): for each event, each person
 * picks how they hear about it -- a text or an email as it happens, in a daily
 * or a weekly digest (text or email), or not at all.
 */
export const CHANNELS = ['text_now', 'email_now', 'text_daily', 'email_daily', 'text_weekly', 'email_weekly'] as const;
export type Channel = (typeof CHANNELS)[number];
export type Matrix = Record<string, Channel[]>;

export interface NotifyEvent {
  key: string;
  label: string;
  group: 'CRM' | 'Projects' | 'Tasks';
  hint: string;
  /** The menu item someone needs to see to hear about it (company-wide events). */
  module?: string;
  defaults: Channel[];
}

export const NOTIFY_EVENTS: NotifyEvent[] = [
  { key: 'lead_new', label: 'Incoming lead', group: 'CRM', module: 'pipeline', hint: 'A new lead is added to the CRM.', defaults: ['email_now'] },
  { key: 'lead_status', label: 'Lead status changes', group: 'CRM', module: 'pipeline', hint: 'A lead moves stage, is archived, rejected or converted to a project.', defaults: ['email_daily'] },
  { key: 'design_status', label: 'Design status changes', group: 'Projects', module: 'design', hint: 'A project moves to another design phase.', defaults: ['email_daily'] },
  { key: 'construction_status', label: 'Construction status changes', group: 'Projects', module: 'pm', hint: 'A project’s construction stage changes.', defaults: ['email_daily'] },
  { key: 'high_viz', label: 'High Viz', group: 'Projects', module: 'tasks', hint: 'Anything on a task labelled “High Viz” — the team decides which work is High Viz.', defaults: ['email_now'] },
  { key: 'task_status', label: 'All tasks status', group: 'Tasks', hint: 'A task you’re on (assignee, assigner, source or collaborator) changes status or is done.', defaults: ['email_daily'] },
  { key: 'task_assigned', label: 'Newly assigned tasks', group: 'Tasks', hint: 'You’re given a task, or added as a collaborator.', defaults: ['email_now'] },
  { key: 'task_comment', label: 'Comments on my tasks', group: 'Tasks', hint: 'Someone comments on a task you’re on.', defaults: ['email_now'] },
  { key: 'mention', label: '@mentions', group: 'Tasks', hint: 'Someone mentions you in a comment.', defaults: ['email_now'] },
  { key: 'due_tomorrow', label: 'Coming due in 1 day', group: 'Tasks', hint: 'A task assigned to you is due tomorrow.', defaults: ['email_now'] },
  { key: 'past_due', label: 'Past due tasks', group: 'Tasks', hint: 'A task assigned to you is past its due date (each day until it’s done).', defaults: ['email_daily'] },
  { key: 'three_week', label: 'Three-week look-ahead', group: 'Tasks', hint: 'Every Monday: your tasks due in the next three weeks.', defaults: ['email_weekly'] },
];
export const EVENT_KEYS = NOTIFY_EVENTS.map((e) => e.key);
export const eventOf = (key: string) => NOTIFY_EVENTS.find((e) => e.key === key);

/** A saved matrix, cleaned: known events and channels only. An event saved as [] means "no notification". */
export function cleanMatrix(raw: unknown): Matrix {
  const out: Matrix = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!EVENT_KEYS.includes(k) || !Array.isArray(v)) continue;
    out[k] = [...new Set(v.filter((c): c is Channel => (CHANNELS as readonly string[]).includes(String(c))))];
  }
  return out;
}

/**
 * How this person hears about an event: what they chose, else the default.
 * Before the matrix, "email me when I'm assigned" could be switched off --
 * that still holds for the task emails until they choose here.
 */
export function channelsFor(user: { notificationMatrix?: Matrix | Record<string, string[]> | null; notifyOnAssignment?: boolean | null }, event: string): Channel[] {
  const chosen = user.notificationMatrix ? cleanMatrix(user.notificationMatrix)[event] : undefined;
  if (chosen) return chosen;
  const defaults = eventOf(event)?.defaults || [];
  if (!user.notificationMatrix && user.notifyOnAssignment === false && ['task_assigned', 'task_comment', 'task_status'].includes(event)) return defaults.filter((c) => c !== 'email_now');
  return defaults;
}

export const isText = (c: Channel) => c.startsWith('text_');
export const isDigest = (c: Channel) => c.endsWith('_daily') || c.endsWith('_weekly');

/** What's missing for the channels someone chose: a phone number for texts, an email for emails. */
export function channelWarnings(matrix: Matrix | null | undefined, has: { phone: boolean; email: boolean; smsReady: boolean }) {
  const all = EVENT_KEYS.flatMap((k) => channelsFor({ notificationMatrix: matrix ?? null }, k));
  const out: string[] = [];
  if (all.some(isText) && !has.phone) out.push('You chose text messages but there’s no phone number to text — add yours below.');
  if (all.some(isText) && has.phone && !has.smsReady) out.push('Text messages aren’t set up for the workspace yet (Settings → SMS), so texts won’t go out.');
  if (all.some((c) => !isText(c)) && !has.email) out.push('You chose emails but your account has no email address.');
  return out;
}
