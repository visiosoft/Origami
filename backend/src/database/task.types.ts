// Shapes stored inside the simple-json columns on both task entities.
// Mirrored on the client in frontend/src/data/projectTasks.ts.

/**
 * A file on a task. Either a real upload living in Google Drive (`kind: 'drive'`)
 * or a hand-typed external link (`kind: 'link'`), which is what every row created
 * before uploads existed looks like.
 */
export interface TaskAttachment {
  id: string;                 // our own id — the handle the browser addresses
  name: string;
  kind: 'drive' | 'link';
  driveId?: string;           // kind === 'drive'
  url?: string;               // kind === 'link' (legacy {name,url} rows land here)
  webViewLink?: string;       // "Open in Drive" escape hatch
  size?: number;
  mimeType?: string;
  uploadedBy?: string;
  uploadedById?: string;
  uploadedAt?: string;
}

export interface TaskComment {
  id: string;
  author: string;
  authorId?: string;
  text: string;
  date: string;
}

export interface ChecklistItem {
  id: string;
  item: string;
  done: boolean;
}

/** One entry in a task's history — field edits, comments, files, assignment. */
export interface ActivityEvent {
  id: string;
  type: 'created' | 'field' | 'comment' | 'attachment' | 'assign' | 'status' | 'collaborators';
  field?: string;
  from?: string;
  to?: string;
  text?: string;
  by: string;
  byId?: string;
  at: string;                 // ISO timestamp
}

/** Statuses for project (board) tasks. Kept in sync with the `completed` flag. */
export const TASK_STATUSES = ['Not started', 'In progress', 'On hold', 'Done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/**
 * "Blocked" and "On hold" were two names for one thing (Sep 25 meeting) --
 * one status now, "On hold"; the old spellings still come in from older
 * screens and imports and are read as it.
 */
export function normalizeTaskStatus(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (/^(blocked|on[\s-]*hold|hold)$/i.test(s)) return 'On hold';
  return s;
}

/** A board column that means "on hold" -- a task's status and that column move together. */
export const isHoldSection = (name?: string | null) => /^(on[\s-]*hold|blocked)$/i.test((name || '').trim());

let counter = 0;
/** Short unique id for json sub-records (no uuid dependency in this app). */
export function subId(prefix: string): string {
  counter = (counter + 1) % 100000;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}`;
}

/**
 * Older rows are `{ name, url }` with no id and no kind. Fill both in on read so
 * the client can address every attachment uniformly.
 */
export function normalizeAttachments(raw: unknown): TaskAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a: any, i: number) => ({
    ...a,
    id: a?.id || `a${i}`,
    name: a?.name || 'Attachment',
    kind: a?.kind || (a?.driveId ? 'drive' : 'link'),
  }));
}

export function normalizeList<T>(raw: unknown): T[] {
  return Array.isArray(raw) ? (raw as T[]) : [];
}

/** Build an activity entry. */
export function event(
  type: ActivityEvent['type'],
  by: { name: string; id?: string },
  extra: Partial<ActivityEvent> = {},
): ActivityEvent {
  return {
    id: subId('e'),
    type,
    by: by.name,
    byId: by.id,
    at: new Date().toISOString(),
    ...extra,
  };
}

/** Fields worth recording a history entry for, and how to label them. */
export const TRACKED_FIELDS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  dueDate: 'Due date',
  priority: 'Priority',
  status: 'Status',
  sectionId: 'Section',
  assignee: 'Assignee',
  assignedTo: 'Assignee',
  resolution: 'Resolution',
  meetingDate: 'Meeting date',
  dateClosed: 'Date closed',
  topicType: 'Topic type',
  project: 'Project',
};

/**
 * Compare an existing record against an incoming patch and produce one event per
 * meaningful change. Used by both task services so their histories look alike.
 */
/** Someone following a task without owning it ("Collaborative"). */
export interface Collaborator { id: string; name: string }

/** A clean list: one entry per user id, never the assignee, never blank. */
export function normalizeCollaborators(list: unknown, assigneeId?: string | null): Collaborator[] {
  const seen = new Set<string>();
  const out: Collaborator[] = [];
  for (const c of Array.isArray(list) ? list : []) {
    const id = String((c as any)?.id || '').trim();
    if (!id || seen.has(id) || id === assigneeId) continue;
    seen.add(id);
    out.push({ id, name: String((c as any)?.name || '').trim() || id });
  }
  return out;
}

/** Who joined and who left, for the activity feed and the "you were added" email. */
export function collaboratorChanges(before: unknown, after: Collaborator[]) {
  const prev = normalizeCollaborators(before);
  const had = new Set(prev.map((c) => c.id));
  const has = new Set(after.map((c) => c.id));
  return { added: after.filter((c) => !had.has(c.id)), removed: prev.filter((c) => !has.has(c.id)) };
}

export function diffEvents(
  before: Record<string, any>,
  patch: Record<string, any>,
  by: { name: string; id?: string },
): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  for (const [key, label] of Object.entries(TRACKED_FIELDS)) {
    if (!(key in patch)) continue;
    const from = before?.[key] ?? '';
    const to = patch[key] ?? '';
    if (String(from) === String(to)) continue;
    out.push(
      event(key === 'status' ? 'status' : key === 'assignee' || key === 'assignedTo' ? 'assign' : 'field', by, {
        field: key,
        from: String(from),
        to: String(to),
        text: label,
      }),
    );
  }
  return out;
}
