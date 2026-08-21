export declare class UpdateTaskDto {
    tab?: string;
    meetingType?: string;
    meetingDate?: string;
    assignedTo?: string;
    assignedToId?: string;
    status?: string;
    originator?: string;
    topicType?: string;
    description?: string;
    dueDate?: string;
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
}
export declare class AddCommentDto {
    text: string;
}
export declare class AddLinkDto {
    name?: string;
    url: string;
}
