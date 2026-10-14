import { MEETING_LOCATION_TYPES, MEETING_STATUSES } from './meeting-status';
export declare const MEETING_TYPES: string[];
export { MEETING_LOCATION_TYPES, MEETING_STATUSES };
export declare const MEETING_ACTION_TOPICS: string[];
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
    locationType?: string;
    attendees?: AttendeeDto[];
    agenda?: string;
    minutes?: string;
    status?: string;
    rfiIds?: string[];
    changeOrderIds?: string[];
    recordingUrl?: string;
    transcriptUrl?: string;
    transcript?: string;
}
export declare class MeetingActionDto {
    topicType: string;
    subject: string;
    description?: string;
    assignedTo?: string;
    assignedToId?: string;
    dueDate?: string;
}
