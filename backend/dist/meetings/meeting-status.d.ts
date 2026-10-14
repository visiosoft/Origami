export declare const MEETING_STATUSES: readonly ["scheduled", "occurred", "cancelled", "rescheduled", "reviewed", "complete"];
export type MeetingStatus = (typeof MEETING_STATUSES)[number];
export declare const MEETING_LOCATION_TYPES: readonly ["virtual", "call", "text", "in_person"];
export declare function normalizeMeetingStatus(raw?: string | null): MeetingStatus;
export interface CapturedAction {
    kind: 'task' | 'rfi' | 'changeOrder';
    status?: string | null;
}
export declare function isActionDone(a: CapturedAction, closedTaskStatuses?: string[]): boolean;
export declare function settleMeetingStatus(raw: string | null | undefined, actions: CapturedAction[], closedTaskStatuses?: string[]): MeetingStatus;
