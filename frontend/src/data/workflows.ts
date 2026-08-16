// Types + style maps for the Workflows feature.

export type WorkflowStatus = 'Active' | 'Draft' | 'Archived';
export type WorkflowItemStatus = 'Open' | 'In Progress' | 'Done';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  owner?: string;
  createdAt: string;
}

export interface WorkflowItem {
  id: string;
  workflowId: string;
  title: string;
  status: WorkflowItemStatus;
  notes?: string;
  order: number;
  createdAt: string;
}

export const WF_STATUSES: WorkflowStatus[] = ['Active', 'Draft', 'Archived'];
export const WF_ITEM_STATUSES: WorkflowItemStatus[] = ['Open', 'In Progress', 'Done'];

export const WF_STATUS_STYLE: Record<WorkflowStatus, { bg: string; c: string }> = {
  Active: { bg: '#D2EAD3', c: '#1E6B36' },
  Draft: { bg: '#EFEDE8', c: '#5C6B65' },
  Archived: { bg: '#F2DFD4', c: '#8E2E0A' },
};

export const WF_ITEM_STATUS_STYLE: Record<WorkflowItemStatus, { bg: string; c: string }> = {
  Open: { bg: '#EFEDE8', c: '#3A423E' },
  'In Progress': { bg: '#D6E8E5', c: '#2F6F68' },
  Done: { bg: '#D2EAD3', c: '#1C5230' },
};
