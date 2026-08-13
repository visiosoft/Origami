export type ViewMode = 'internal' | 'client' | 'consultant';
export interface FinanceRow {
    name: string;
    exec: string;
    contract: string;
    labor: string;
    phase: string;
    base: number;
    co: number;
    reimb: number;
    baseUsed: number;
    coUsed: number;
    reimbUsed: number;
    timePct: number;
}
export declare const FINANCE: FinanceRow[];
export interface RawInvoice {
    id: string;
    project: string;
    month: string;
    issued: string;
    amount: number;
    paid: number;
}
export declare const INVOICES: Record<ViewMode, RawInvoice[]>;
export interface EnrichedInvoice extends RawInvoice {
    net: number;
    retPct: number;
    billing: string;
    release: string;
    issuedLabel: string;
    dueLabel: string;
    daysLate: number;
    unpaid: number;
    retHeld: number;
    receivable: number;
    pastDue: number;
    withinTerms: number;
    status: 'Paid' | 'Past due' | 'Retention' | 'Within terms';
}
export declare function enrichInvoices(list: RawInvoice[]): EnrichedInvoice[];
export declare const REVENUE_BASE: Record<ViewMode, {
    month: string;
}[]>;
export interface FunnelRow {
    label: string;
    n: string;
    v: number;
}
export declare const FUNNEL: Record<ViewMode, FunnelRow[]>;
export interface TeamRow {
    name: string;
    role: string;
    kind: string;
    tasks: number;
    done: number;
    av: string;
}
export declare const TEAM: TeamRow[];
export interface Deadline {
    task: string;
    project: string;
    due: string;
    domain: string;
    owner: string;
    past: boolean;
}
export declare const DEADLINES: Deadline[];
export interface Activity {
    who: string;
    av: string;
    act: string;
    target: string;
    when: string;
    domain: string;
    c: string;
}
export declare const ACTIVITY: Activity[];
export declare const HELP_CONTENT: Record<string, {
    title: string;
    body: string;
    rows: [string, string][];
}>;
export declare const money: (n: number) => string;
