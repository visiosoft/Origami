// Types + style maps for the Workflows feature.

export type WorkflowStatus = 'Active' | 'Draft' | 'Archived';
export type WorkflowItemStatus = 'Open' | 'In Progress' | 'Done';

export interface Workflow {
  id: string;
  projectId?: number | null;
  name: string;
  description?: string;
  status: WorkflowStatus;
  owner?: string;
  estimatedDays?: number | null;
  plannedStart?: string;
  plannedEnd?: string;
  completedAt?: string;
  createdAt: string;
}

export interface WorkflowItem {
  id: string;
  workflowId: string;
  title: string;
  status: WorkflowItemStatus;
  notes?: string;
  order: number;
  estimatedDays?: number | null;
  plannedStart?: string;
  plannedEnd?: string;
  completedAt?: string;
  createdAt: string;
}

// Actual elapsed days between planned start and completion (when both known).
export function actualDays(o: { plannedStart?: string; completedAt?: string }): number | null {
  if (!o.plannedStart || !o.completedAt) return null;
  const a = new Date(o.plannedStart).getTime();
  const b = new Date(o.completedAt).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export const WF_STATUSES: WorkflowStatus[] = ['Active', 'Draft', 'Archived'];
export const WF_ITEM_STATUSES: WorkflowItemStatus[] = ['Open', 'In Progress', 'Done'];

export const WF_STATUS_STYLE: Record<WorkflowStatus, { bg: string; c: string }> = {
  Active: { bg: 'var(--c-d2ead3)', c: 'var(--c-1e6b36)' },
  Draft: { bg: 'var(--c-efede8)', c: 'var(--c-5c6b65)' },
  Archived: { bg: '#F2DFD4', c: '#8E2E0A' },
};

export const WF_ITEM_STATUS_STYLE: Record<WorkflowItemStatus, { bg: string; c: string }> = {
  Open: { bg: 'var(--c-efede8)', c: 'var(--c-3a423e)' },
  'In Progress': { bg: '#D6E8E5', c: '#2F6F68' },
  Done: { bg: 'var(--c-d2ead3)', c: 'var(--success-deep)' },
};
