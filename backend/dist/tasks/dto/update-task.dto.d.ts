export declare class UpdateTaskDto {
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
    description?: string;
    dueDate?: string;
    dueTime?: string;
    dateClosed?: string;
    resolution?: string;
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
export declare class AddCommentDto {
    text: string;
}
export declare class AddLinkDto {
    name?: string;
    url: string;
}
export declare class LinkDto {
    kind: 'task' | 'changeOrder';
    targetId: string;
}
export declare class LinkedTaskDto {
    subject?: string;
    description?: string;
    assignedTo?: string;
    assignedToId?: string;
    dueDate?: string;
}
