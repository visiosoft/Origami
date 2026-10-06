export declare const MEETING_TYPES: string[];
export declare const MEETING_STATUSES: string[];
export declare class AttendeeDto {
    id?: string;
    name: string;
    email?: string;
}
export declare class MeetingDto {
    title?: string;
    type?: string;
    projectId?: number | null;
    project?: string;
    date?: string;
    time?: string;
    location?: string;
    attendees?: AttendeeDto[];
    agenda?: string;
    minutes?: string;
    status?: string;
    rfiIds?: string[];
}
export declare class MeetingActionDto {
    topicType: string;
    subject: string;
    description?: string;
    assignedTo?: string;
    assignedToId?: string;
    dueDate?: string;
}
