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
    type: 'created' | 'field' | 'comment' | 'attachment' | 'assign' | 'status' | 'collaborators' | 'link';
    field?: string;
    from?: string;
    to?: string;
    text?: string;
    by: string;
    byId?: string;
    at: string;
}
export type ActionKind = 'log' | 'board' | 'meeting' | 'rfi' | 'co';
export interface DerivedRef {
    kind: ActionKind;
    id: string;
    label: string;
    how: 'converted' | 'duplicated';
    projectName?: string;
    by: string;
    at: string;
}
export declare const TASK_STATUSES: readonly ["Not started", "In progress", "On hold", "Done"];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export declare function normalizeTaskStatus(v: unknown): string | undefined;
export declare const TASK_BUCKETS: readonly ["Not started", "Assigned", "In progress", "On hold", "Done", "Confirmed"];
export declare function bucketStatus(name?: string | null): string | null;
export declare const isDoneStatus: (s?: string | null) => s is "Done" | "Confirmed";
export declare const isTaskDone: (t: {
    completed?: boolean | null;
    status?: string | null;
}) => boolean;
export declare const isHoldSection: (name?: string | null) => boolean;
export declare function subId(prefix: string): string;
export declare function normalizeAttachments(raw: unknown): TaskAttachment[];
export declare function normalizeList<T>(raw: unknown): T[];
export declare function event(type: ActivityEvent['type'], by: {
    name: string;
    id?: string;
}, extra?: Partial<ActivityEvent>): ActivityEvent;
export declare const TRACKED_FIELDS: Record<string, string>;
export interface Collaborator {
    id: string;
    name: string;
}
export declare function normalizeCollaborators(list: unknown, assigneeId?: string | null): Collaborator[];
export declare function collaboratorChanges(before: unknown, after: Collaborator[]): {
    added: Collaborator[];
    removed: Collaborator[];
};
export declare function diffEvents(before: Record<string, any>, patch: Record<string, any>, by: {
    name: string;
    id?: string;
}): ActivityEvent[];
