import type { ChecklistItem, TaskAttachment, TaskComment } from '../../database/task.types';
export declare class CreateProjectTaskDto {
    id?: string;
    projectId: number;
    sectionId?: string;
    title: string;
    description?: string;
    assignee?: string;
    assigneeId?: string;
    dueDate?: string;
    priority?: string;
    status?: string;
    order?: number;
    completed?: boolean;
    parentId?: string | null;
    labels?: string[];
    checklist?: ChecklistItem[];
    attachments?: TaskAttachment[];
    comments?: TaskComment[];
}
export declare class ReorderDto {
    sectionId: string;
    ids: string[];
}
