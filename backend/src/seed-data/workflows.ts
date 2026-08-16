// Default workflows + items. Editable via the Workflows page; item structure
// will be refined later per requirements.

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

export const DEFAULT_WORKFLOWS: Workflow[] = [
  { id: 'W-1001', name: 'New Client Onboarding', description: 'Standard intake-to-kickoff process for new design + build clients.', status: 'Active', owner: 'Sara R.', createdAt: '2026-06-01' },
  { id: 'W-1002', name: 'Permit & Approvals', description: 'City/county submission and approval tracking.', status: 'Draft', owner: 'Noah K.', createdAt: '2026-07-12' },
];

export const DEFAULT_WORKFLOW_ITEMS: WorkflowItem[] = [
  { id: 'WI-1', workflowId: 'W-1001', title: 'Send welcome packet', status: 'Done', notes: 'Includes contract + schedule overview.', order: 0, createdAt: '2026-06-01' },
  { id: 'WI-2', workflowId: 'W-1001', title: 'Collect site details', status: 'In Progress', notes: '', order: 1, createdAt: '2026-06-02' },
  { id: 'WI-3', workflowId: 'W-1001', title: 'Schedule kickoff meeting', status: 'Open', notes: '', order: 2, createdAt: '2026-06-03' },
  { id: 'WI-4', workflowId: 'W-1002', title: 'Prepare submission set', status: 'Open', notes: '', order: 0, createdAt: '2026-07-12' },
];
