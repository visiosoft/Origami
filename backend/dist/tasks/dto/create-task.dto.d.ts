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
    labels?: string[];
    checklist?: {
        id: string;
        item: string;
        done: boolean;
    }[];
    linkedTaskIds?: string[];
    changeOrderIds?: string[];
}
