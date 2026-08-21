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
  type: 'created' | 'field' | 'comment' | 'attachment' | 'assign' | 'status';
  field?: string;
  from?: string;
  to?: string;
  text?: string;
  by: string;
  byId?: string;
  at: string;
}

export type TaskStatus = 'Not started' | 'In progress' | 'Blocked' | 'Done';
export const TASK_STATUSES: TaskStatus[] = ['Not started', 'In progress', 'Blocked', 'Done'];

export const STATUS_STYLE: Record<TaskStatus, { bg: string; c: string }> = {
  'Not started': { bg: '#EFEDE8', c: '#5C6B65' },
  'In progress': { bg: '#D6E8E5', c: '#2F6F68' },
  Blocked: { bg: '#F2DFD4', c: '#8E2E0A' },
  Done: { bg: '#D2EAD3', c: '#1E6B36' },
};

export interface ProjectSection {
  id: string;
  projectId: number;
  name: string;
  order: number;
}

export interface ProjectTask {
  id: string;
  projectId: number;
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
}

export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Urgent'];

export const PRIORITY_STYLE: Record<Priority, { bg: string; c: string }> = {
  Low: { bg: '#EFEDE8', c: '#5C6B65' },
  Medium: { bg: '#D6E8E5', c: '#2F6F68' },
  High: { bg: '#FBE9AE', c: '#8A6D12' },
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
  { bg: '#DCE7DE', c: '#173326' }, { bg: '#D6E8E5', c: '#2F6F68' },
  { bg: '#FBE9AE', c: '#8A6D12' }, { bg: '#F2DFD4', c: '#8E2E0A' },
  { bg: '#EAE0F3', c: '#5B2E86' }, { bg: '#EDE3D0', c: '#6B4F1D' },
];
export const labelStyle = (label: string) => {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return LABEL_COLORS[hash % LABEL_COLORS.length];
};
