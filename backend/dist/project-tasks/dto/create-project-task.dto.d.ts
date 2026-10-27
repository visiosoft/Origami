import type { ChecklistItem, Collaborator, TaskAttachment, TaskComment } from '../../database/task.types';
export declare class CreateProjectTaskDto {
    id?: string;
    projectId?: number | null;
    sectionId?: string;
    title: string;
    description?: string;
    assignee?: string;
    assigneeId?: string;
    dueDate?: string;
    priority?: string;
    leadId?: string;
    holdReason?: string;
    completionNote?: string;
    requestedById?: string;
    requestedBy?: string;
    deferNotify?: boolean;
    close?: boolean;
    status?: string;
    order?: number;
    completed?: boolean;
    parentId?: string | null;
    labels?: string[];
    collaborators?: Collaborator[];
    checklist?: ChecklistItem[];
    attachments?: TaskAttachment[];
    comments?: TaskComment[];
    phaseId?: string | null;
    team?: string;
    auto?: boolean;
    autoLabel?: string;
    startDate?: string;
    endDate?: string;
    durationDays?: number;
    dependsOn?: string[];
}
declare const UpdateProjectTaskDto_base: import("@nestjs/mapped-types").MappedType<Partial<CreateProjectTaskDto>>;
export declare class UpdateProjectTaskDto extends UpdateProjectTaskDto_base {
}
export declare class ReorderDto {
    sectionId: string;
    ids: string[];
}
export {};
