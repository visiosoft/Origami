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
export declare const DEFAULT_WORKFLOWS: Workflow[];
export declare const DEFAULT_WORKFLOW_ITEMS: WorkflowItem[];
