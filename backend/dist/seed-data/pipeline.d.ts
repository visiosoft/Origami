export interface TimelineEvent {
    date: string;
    action: string;
    role: string;
    type: 'auto' | 'pc' | 'pm';
}
export interface Deal {
    id: string;
    name: string;
    client: string;
    value: string;
    stage: string;
    stageIdx: number;
    assignedRole: string;
    assignee: string;
    assigneeInit: string;
    daysInStage: number;
    nextAction: string;
    nextDue: string;
    source: string;
    status: 'overdue' | 'awaiting_pm' | 'awaiting_client' | 'in_progress';
    phone: string;
    email: string;
    timeline: TimelineEvent[];
    notes: string;
    holdUntil?: string;
    archived?: boolean;
    archivedAt?: string;
    convertedProjectId?: number | null;
    roles?: Record<string, string>;
}
export interface Stage {
    key: string;
    name: string;
    idx: number;
    owner: string;
    ownerColor: string;
    ownerBg: string;
    color: string;
    colorBg: string;
    isDecision?: boolean;
    isLost?: boolean;
    isHold?: boolean;
    holdMonths?: number;
    isClosed?: boolean;
}
export declare const STAGES: Stage[];
export declare const STAGE_KEYS: string[];
export declare const STATUS_STYLES: Record<string, {
    label: string;
    bg: string;
    color: string;
    dot: string;
}>;
export declare const DEALS: Deal[];
export declare const BLOCKED_STAGES_BY_DELIVERY: Record<string, string[]>;
export declare function deliveryCode(contractType?: string): string;
export declare function stageBlockedFor(contractType: string | undefined, stageKey: string): boolean;
