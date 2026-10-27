import type { Collaborator } from '../../database/task.types';
export declare class CreateTaskDto {
    id?: string;
    tab?: string;
    meetingType?: string;
    meetingDate?: string;
    assignedTo?: string;
    assignedToId?: string;
    status?: string;
    originator?: string;
    topicType?: string;
    meetingId?: string;
    subject?: string;
    priority?: string;
    leadId?: string;
    holdReason?: string;
    completionNote?: string;
    deferNotify?: boolean;
    description?: string;
    startDate?: string;
    dueDate?: string;
    dueTime?: string;
    linkedFile?: string;
    project?: string;
    resolution?: string;
    dateClosed?: string;
    labels?: string[];
    collaborators?: Collaborator[];
    checklist?: {
        id: string;
        item: string;
        done: boolean;
    }[];
    linkedTaskIds?: string[];
    changeOrderIds?: string[];
}
