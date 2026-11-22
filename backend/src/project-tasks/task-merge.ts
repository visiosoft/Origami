import { event, normalizeList, type ActivityEvent, type TaskAttachment, type TaskComment } from '../database/task.types';

/**
 * Merging duplicate tasks (Nov 17 sync, Astrid: two PG&E tasks, each with its
 * own updates and files). Nothing is deleted: the kept task gains every file,
 * comment and history entry; each duplicate becomes a closed subtask of it
 * ("Merged into …"), and the duplicates' own subtasks move under the kept one.
 */
export interface MergeTask {
  id: string; title: string; projectId: number | null; parentId?: string | null; epicId?: string | null;
  attachments?: TaskAttachment[] | null; comments?: TaskComment[] | null; activity?: ActivityEvent[] | null;
  collaborators?: { id: string; name: string }[] | null; labels?: string[] | null; tags?: string[] | null;
  assigneeId?: string | null; commentCount?: number | null;
}

export function mergeProblem(keep: MergeTask | null, dupes: (MergeTask | null)[]): string | null {
  if (!keep) return 'The task to keep no longer exists.';
  if (keep.parentId) return 'Keep a main task, not a subtask.';
  if (!dupes.length) return 'Pick at least one other task to merge in.';
  for (const d of dupes) {
    if (!d) return 'One of the tasks no longer exists.';
    if (d.id === keep.id) return 'A task can’t be merged into itself.';
    if (d.parentId) return `“${d.title}” is a subtask — merge main tasks only.`;
    if ((d.projectId ?? null) !== (keep.projectId ?? null)) return `“${d.title}” is on another board — merge tasks from the same board.`;
  }
  return null;
}

const label = (d: MergeTask, number?: string) => `${number || '#' + d.id} “${d.title}”`;
const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

/** The kept task's new lists, and the patch each duplicate gets. */
export function planMerge(keep: MergeTask, dupes: MergeTask[], actor: { name: string; id?: string }, at = new Date().toISOString(), numberOf: (t: MergeTask) => string | undefined = () => undefined) {
  const attachments = [...normalizeList<TaskAttachment>(keep.attachments)];
  const comments = [...normalizeList<TaskComment>(keep.comments)];
  const activity = [...normalizeList<ActivityEvent>(keep.activity)];
  let collaborators = [...normalizeList<{ id: string; name: string }>(keep.collaborators)];
  let labels = normalizeList<string>(keep.labels);
  let tags = normalizeList<string>(keep.tags);
  const dupePatches: { id: string; patch: Record<string, unknown> }[] = [];

  for (const d of dupes) {
    const from = label(d, numberOf(d));
    for (const a of normalizeList<TaskAttachment>(d.attachments)) if (!attachments.some((x) => x.id === a.id)) attachments.push({ ...a, name: a.name });
    for (const c of normalizeList<TaskComment>(d.comments)) comments.push({ ...c, text: `[from ${from}] ${c.text}` });
    // Its history comes along, marked with where it came from, in time order with the rest.
    for (const e of normalizeList<ActivityEvent>(d.activity)) activity.push({ ...e, text: `[${from}] ${e.text || [e.field, e.from && `${e.from} →`, e.to].filter(Boolean).join(' ') || e.type}` });
    for (const c of normalizeList<{ id: string; name: string }>(d.collaborators)) if (c?.id && c.id !== keep.assigneeId && !collaborators.some((x) => x.id === c.id)) collaborators.push(c);
    labels = union(labels, normalizeList<string>(d.labels));
    tags = union(tags, normalizeList<string>(d.tags));
    activity.push(event('link', actor, { text: `merged in ${from}: its files, comments and history are here; it is now a closed subtask`, at }));
    const dupActivity = [...normalizeList<ActivityEvent>(d.activity), event('link', actor, { text: `merged into ${label(keep, numberOf(keep))}`, at })];
    dupePatches.push({
      id: d.id,
      patch: {
        parentId: keep.id, epicId: keep.epicId ?? null, status: 'Done', completed: true,
        completionNote: `Merged into ${label(keep, numberOf(keep))}`, archivedAt: at, closedAt: at,
        activity: dupActivity, updatedAt: at,
      },
    });
  }
  activity.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  collaborators = collaborators.filter((c) => c.id !== keep.assigneeId);
  return {
    keep: { attachments, comments, commentCount: comments.length, activity, collaborators, labels, tags, updatedAt: at },
    dupes: dupePatches,
  };
}
