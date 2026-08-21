export interface TaskAttachment {
    id: string;
    name: string;
    kind: 'drive' | 'link';
    driveId?: string;
    url?: string;
    webViewLink?: string;
    size?: number;
    mimeType?: string;
    uploadedBy?: string;
    uploadedById?: string;
    uploadedAt?: string;
}
export interface TaskComment {
    id: string;
    author: string;
    authorId?: string;
    text: string;
    date: string;
}
export interface ChecklistItem {
    id: string;
    item: string;
    done: boolean;
}
export interface ActivityEvent {
    id: string;
    type: 'created' | 'field' | 'comment' | 'attachment' | 'assign' | 'status';
    field?: string;
    from?: string;
    to?: string;
    text?: string;
    by: string;
    byId?: string;
    at: string;
}
export declare const TASK_STATUSES: readonly ["Not started", "In progress", "Blocked", "Done"];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export declare function subId(prefix: string): string;
export declare function normalizeAttachments(raw: unknown): TaskAttachment[];
export declare function normalizeList<T>(raw: unknown): T[];
export declare function event(type: ActivityEvent['type'], by: {
    name: string;
    id?: string;
}, extra?: Partial<ActivityEvent>): ActivityEvent;
export declare const TRACKED_FIELDS: Record<string, string>;
export declare function diffEvents(before: Record<string, any>, patch: Record<string, any>, by: {
    name: string;
    id?: string;
}): ActivityEvent[];
