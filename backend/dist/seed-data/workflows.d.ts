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
export declare const DEFAULT_WORKFLOWS: Workflow[];
export declare const DEFAULT_WORKFLOW_ITEMS: WorkflowItem[];
