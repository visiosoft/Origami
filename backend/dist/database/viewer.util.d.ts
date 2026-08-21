import type { SessionClaims } from '../auth/crypto.util';
export declare function isRestrictedViewer(claims: SessionClaims): boolean;
export declare function assignedTo(task: {
    assigneeId?: string;
    assignee?: string;
    assignedToId?: string;
    assignedTo?: string;
}, claims: SessionClaims): boolean;
export declare function scopeTasks<T extends Record<string, any>>(tasks: T[], claims: SessionClaims | null): T[];
