export interface Task {
    id: string;
    meetingType: 'Internal' | 'Owner' | 'Subcontractor';
    meetingDate: string;
    assignedTo: string;
    status: 'Open' | 'Closed' | 'In Progress';
    originator: string;
    topicType: 'Task' | 'FYI' | 'RFI';
    description: string;
    dueDate: string;
    dateClosed: string;
    daysOpen: number;
    resolution: string;
    linkedFile: string;
    project: string;
}
export type TaskTab = 'internal' | 'owner' | 'subcontractor';
export declare const ALL_TASKS: Record<TaskTab, Task[]>;
export declare const ST_COLORS: Record<string, {
    bg: string;
    c: string;
}>;
export declare const TT_COLORS: Record<string, {
    bg: string;
    c: string;
}>;
export declare const MT_COLORS: Record<string, {
    bg: string;
    c: string;
}>;
export interface AuditEntry {
    what: string;
    by: string;
    when: string;
    chip: string;
    chipBg: string;
    chipC: string;
    dot: string;
}
export declare function getLeadTime(t: Task): {
    leadTime: number;
    openDays: number;
    variance: number;
    source: string;
    audit: AuditEntry[];
    label: string;
    bg: string;
    color: string;
};
export declare const NEW_TASK_FIELDS: {
    label: string;
    value: string;
    valColor: string;
    span: string;
    required: boolean;
}[];
