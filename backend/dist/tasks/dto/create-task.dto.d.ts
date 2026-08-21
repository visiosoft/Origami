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
    description: string;
    dueDate?: string;
    linkedFile?: string;
    project?: string;
    labels?: string[];
    checklist?: {
        id: string;
        item: string;
        done: boolean;
    }[];
}
