// Types + style maps for the Asana-style per-project task board.

export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';

/**
 * A file on a task: either a real upload stored in Google Drive (`kind: 'drive'`)
 * or a hand-typed external link (`kind: 'link'`) — which is what every row
 * created before uploads existed looks like.
 */
export interface Attachment {
  id: string;
  name: string;
  kind: 'drive' | 'link';
  driveId?: string;
  url?: string;
  webViewLink?: string;
  size?: number;
  mimeType?: string;
  uploadedBy?: string;
  uploadedById?: string;
  uploadedAt?: string;
}

export interface TaskComment { id: string; author: string; authorId?: string; text: string; date: string }
export interface ChecklistItem { id: string; item: string; done: boolean }

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
  at: string;
}

/** "Blocked" and "On hold" were one thing under two names -- it's "On hold" now. */
export type TaskStatus = 'Not started' | 'In progress' | 'On hold' | 'Done';
export const TASK_STATUSES: TaskStatus[] = ['Not started', 'In progress', 'On hold', 'Done'];

export const STATUS_STYLE: Record<string, { bg: string; c: string }> = {
  'Not started': { bg: 'var(--c-efede8)', c: 'var(--c-5c6b65)' },
  'In progress': { bg: '#D6E8E5', c: '#2F6F68' },
  'On hold': { bg: 'var(--amber-light)', c: '#93520F' },
  Blocked: { bg: 'var(--amber-light)', c: '#93520F' }, // an older row not yet renamed
  Done: { bg: 'var(--c-d2ead3)', c: 'var(--c-1e6b36)' },
};

export interface ProjectSection {
  id: string;
  /** null = the General Tasks board's sections, not tied to any project. */
  projectId: number | null;
  name: string;
  order: number;
}

export interface ProjectTask {
  id: string;
  /** People following the task without owning it ("Collaborative"). */
  collaborators?: { id: string; name: string }[];
  /** null = a General Tasks board task, not tied to any client project. */
  projectId: number | null;
  sectionId: string;
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  priority?: Priority;
  order: number;
  completed: boolean;
  parentId?: string | null;
  attachments?: Attachment[];
  comments?: TaskComment[];
  createdAt: string;
  /** users.id — `assignee` is kept alongside as the display name. */
  assigneeId?: string;
  status?: TaskStatus;
  checklist?: ChecklistItem[];
  labels?: string[];
  activity?: ActivityEvent[];
  updatedAt?: string;
  // --- Phase Board ---
  /** null/undefined = ad-hoc task, shown on the kanban. */
  phaseId?: string | null;
  team?: string;
  auto?: boolean;
  autoLabel?: string;
  startDate?: string;
  endDate?: string;
  durationDays?: number | null;
  dependsOn?: string[];
}

/** A stage of the delivery programme. Tasks are filed under one. */
export interface ProjectPhase {
  id: string;
  projectId: number;
  key: string;
  name: string;
  color: string;
  order: number;
  startDate?: string;
  endDate?: string;
}

export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Urgent'];

export const PRIORITY_STYLE: Record<Priority, { bg: string; c: string }> = {
  Low: { bg: 'var(--c-efede8)', c: 'var(--c-5c6b65)' },
  Medium: { bg: '#D6E8E5', c: '#2F6F68' },
  High: { bg: 'var(--amber-light)', c: 'var(--c-8a6d12)' },
  Urgent: { bg: '#F2DFD4', c: '#8E2E0A' },
};

// Top-level tasks (exclude subtasks) grouped by section id.
export const topLevelBySection = (tasks: ProjectTask[], sectionId: string): ProjectTask[] =>
  tasks.filter((t) => !t.parentId && t.sectionId === sectionId).sort((a, b) => a.order - b.order);

export const subtasksOf = (tasks: ProjectTask[], parentId: string): ProjectTask[] =>
  tasks.filter((t) => t.parentId === parentId).sort((a, b) => a.order - b.order);

export const checklistProgress = (items?: ChecklistItem[]) => {
  const list = items ?? [];
  return { done: list.filter((i) => i.done).length, total: list.length };
};

/** Deterministic colour for a free-form label, so tags look stable. */
const LABEL_COLORS = [
  { bg: 'var(--mint)', c: 'var(--forest)' }, { bg: '#D6E8E5', c: '#2F6F68' },
  { bg: 'var(--amber-light)', c: 'var(--c-8a6d12)' }, { bg: '#F2DFD4', c: '#8E2E0A' },
  { bg: '#EAE0F3', c: '#5B2E86' }, { bg: 'var(--sand)', c: '#6B4F1D' },
];
export const labelStyle = (label: string) => {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return LABEL_COLORS[hash % LABEL_COLORS.length];
};

/**
 * Who put a task on its current assignee, and when: the latest assignment in
 * its history, else whoever created it already assigned. Null when nobody is
 * assigned or the history doesn't say. Works for board and request-log tasks.
 */
export function assignedByOf(t: { activity?: ActivityEvent[]; assignee?: string; assignedTo?: string }): { by: string; at: string } | null {
  const who = String(t.assignee ?? t.assignedTo ?? '').trim();
  if (!who) return null;
  const events = Array.isArray(t.activity) ? t.activity : [];
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'assign' && String(e.to || '').trim()) return { by: e.by, at: e.at };
  }
  const created = events.find((e) => e.type === 'created');
  return created ? { by: created.by, at: created.at } : null;
}

/** "Assigned by Sara R. · Oct 6", or "Self-assigned · Oct 6". */
export function assignedByText(t: { activity?: ActivityEvent[]; assignee?: string; assignedTo?: string }): string {
  const a = assignedByOf(t);
  if (!a) return '';
  const who = String(t.assignee ?? t.assignedTo ?? '').trim();
  const when = a.at ? new Date(a.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  return `${a.by && a.by === who ? 'Self-assigned' : 'Assigned by ' + (a.by || 'someone')}${when ? ' · ' + when : ''}`;
}
