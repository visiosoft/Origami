// Types + style maps for the Asana-style per-project task board.

export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface Attachment { name: string; url: string }
export interface TaskComment { id: string; author: string; text: string; date: string }

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
