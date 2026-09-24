export type Category = 'design' | 'construction' | 'other';
export type ItemKind = 'project' | 'phase' | 'task';
export interface ItemFin {
    contractValue: number | null;
    reportedProgress: number;
    approvedProgress: number;
    retentionPctOverride?: number | null;
    taxPctOverride?: number | null;
    billingMethod?: string;
}
export interface CalcPhase {
    id: string;
    key: string;
    name: string;
    order: number;
    category: Category;
}
export interface CalcTask {
    id: string;
    title: string;
    phaseId: string | null;
    done: boolean;
    order: number;
}
export interface IssuedLine {
    id: string;
    invoiceId: string;
    kind: string;
    targetType?: string | null;
    phaseId?: string | null;
    taskId?: string | null;
    amountC: number;
    retentionC: number;
    taxC: number;
}
export interface IssuedInvoice {
    id: string;
    totalC: number;
    dueDate?: string | null;
    creditForId?: string | null;
}
export interface PaymentFact {
    invoiceId: string;
    amountC: number;
}
export declare const isContractWork: (kind: string) => kind is "manual" | "progress";
export interface LineMathInput {
    kind: string;
    amountC: number;
    retentionApplies: boolean;
    retentionPct: number;
    taxable: boolean;
    taxPct: number;
}
export interface LineMath {
    retentionC: number;
    netC: number;
    taxC: number;
}
export declare function lineMath(l: LineMathInput): LineMath;
export interface InvoiceTotals {
    contractWorkC: number;
    retentionC: number;
    adjustmentC: number;
    reimbursableC: number;
    retentionReleaseC: number;
    taxC: number;
    totalC: number;
}
export declare function invoiceTotals(lines: LineMathInput[]): InvoiceTotals;
export declare function allocatePayments(lines: IssuedLine[], invoiceTotalC: number, paidC: number): Map<string, number>;
export interface Figures {
    valueC: number | null;
    evC: number;
    invoicedC: number;
    retentionC: number;
    paidC: number;
    billableC: number;
    overBilledC: number;
    remainingC: number;
    outstandingC: number;
    reportedProgress: number;
    approvedProgress: number;
    billableProgress: number;
    physicalProgress: number;
    progressStatus: 'not_started' | 'in_progress' | 'complete';
    billingStatus: 'not_billable' | 'not_invoiced' | 'ready_to_invoice' | 'partially_invoiced' | 'fully_invoiced' | 'over_billed';
    paymentStatus: 'none' | 'unpaid' | 'partially_paid' | 'paid';
}
export interface SovRow extends Figures {
    kind: ItemKind;
    id: string;
    name: string;
    phaseId?: string | null;
    category?: Category;
    ownValueC: number | null;
    valueFromTasks?: boolean;
    billedAsWhole?: boolean;
    deleted?: boolean;
    changeOrdersC?: number;
    retentionReleasedC?: number;
    fin: Partial<ItemFin> & {
        version?: number;
    } | null;
    children?: SovRow[];
}
export interface SovGroup {
    category: Category | 'unphased';
    label: string;
    rows: SovRow[];
    totals: Figures;
}
export interface SovInput {
    originalContractC: number;
    approvedChangesC: number;
    requireApproval: boolean;
    project: ItemFin & {
        version?: number;
    };
    phases: CalcPhase[];
    tasks: CalcTask[];
    phaseFin: Map<string, ItemFin & {
        version?: number;
    }>;
    taskFin: Map<string, ItemFin & {
        version?: number;
        phaseId?: string | null;
    }>;
    lines: IssuedLine[];
    invoices: IssuedInvoice[];
    payments: PaymentFact[];
    today: string;
    coAdjust?: Map<string, number>;
    pendingChangesC?: number;
}
export interface SovResult {
    summary: {
        originalContractC: number;
        approvedChangesC: number;
        revisedContractC: number;
        allocatedC: number;
        unallocatedC: number;
        allocation: 'under' | 'full' | 'over';
        evC: number;
        contractWorkInvoicedC: number;
        invoiceTotalsC: number;
        paidC: number;
        arOutstandingC: number;
        unbilledEarnedC: number;
        overBilledC: number;
        remainingContractC: number;
        retentionHeldC: number;
        billableNowC: number;
        overdueC: number;
        overdueCount: number;
        lumpSum: boolean;
        pendingChangesC: number;
        retentionAccruedC: number;
        retentionReleasedC: number;
        reimbursablesBilledC: number;
        creditsC: number;
    };
    groups: SovGroup[];
    lump: SovRow | null;
}
export declare function computeSov(i: SovInput): SovResult;
export declare function toDollars<T>(x: T): any;
