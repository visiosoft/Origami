import { normalizeList, type ActivityEvent, type TaskComment } from '../database/task.types';
import { pageArgs, pageOf, type Page } from './paging';

export const ACTIVITY_PAGE_SIZE = 20;

export type ActivityEntry =
  | { kind: 'event'; at: string; event: ActivityEvent }
  | { kind: 'comment'; at: string; comment: TaskComment };

/**
 * A task's history as one timeline, newest first: its activity events plus any
 * comment from before the activity log existed (same merge as ActivityFeed).
 * An entry without a readable time sorts as the oldest.
 */
export function activityEntries(rawComments: unknown, rawActivity: unknown): ActivityEntry[] {
  const activity = normalizeList<ActivityEvent>(rawActivity);
  const comments = normalizeList<TaskComment>(rawComments);
  const logged = new Set(activity.filter((e) => e.type === 'comment').map((e) => e.text));
  const all: ActivityEntry[] = [
    ...activity.map((e) => ({ kind: 'event' as const, at: e.at, event: e })),
    ...comments.filter((c) => !logged.has(c.text)).map((c) => ({ kind: 'comment' as const, at: c.date, comment: c })),
  ];
  const t = (at?: string) => { const ms = Date.parse(at || ''); return Number.isNaN(ms) ? 0 : ms; };
  return all.map((e, i) => ({ e, i })).sort((a, b) => t(b.e.at) - t(a.e.at) || b.i - a.i).map((x) => x.e);
}

/** One page of a task's history (20 a page unless asked otherwise). */
export function activityPage(rawComments: unknown, rawActivity: unknown, q: { page?: unknown; size?: unknown }): Page<ActivityEntry> {
  return pageOf(activityEntries(rawComments, rawActivity), pageArgs(q.page, q.size ?? ACTIVITY_PAGE_SIZE));
}
