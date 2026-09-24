export declare const NO_CODE = "none";
export interface LaborFact {
    employeeId: string;
    projectId: number;
    date: string;
    csiCodeId: string | null;
    hours: number;
    source: 'timesheet' | 'daily_log';
}
export interface LaborPerson {
    id: string;
    name: string;
    payType?: string;
    payRate?: number | null;
    overtimeRate?: number | null;
}
export interface LaborSettings {
    standardDayHours: number;
    monthDays: number;
    otMultiplier: number;
}
export interface LaborLine {
    employeeId: string;
    name: string;
    projectId: number;
    date: string;
    csiCodeId: string | null;
    hours: number;
    otHours: number;
    wageC: number;
    source: LaborFact['source'];
    rate: number;
}
export declare function hourlyRate(p: LaborPerson, s: LaborSettings): number;
export declare function laborLines(facts: LaborFact[], people: Map<string, LaborPerson>, s: LaborSettings): LaborLine[];
export declare const burdened: (wageC: number, burdenPct: number) => number;
export interface JobCostInput {
    budgetLines: {
        csiCodeId?: string | null;
        amountC: number;
    }[];
    coCosts: {
        csiCodeId?: string | null;
        amountC: number;
    }[];
    commitments: {
        id: string;
        status: string;
        lines: {
            csiCodeId?: string | null;
            amountC: number;
        }[];
    }[];
    costEntries: {
        commitmentId?: string | null;
        csiCodeId?: string | null;
        amountC: number;
        status: string;
    }[];
    labor: {
        csiCodeId?: string | null;
        costC: number;
        hours: number;
    }[];
    reimbursables: {
        csiCodeId?: string | null;
        costC: number;
    }[];
    forecasts: Map<string, number>;
}
export interface CostRow {
    key: string;
    csiCodeId: string | null;
    budgetOriginalC: number;
    budgetChangesC: number;
    budgetC: number;
    committedC: number;
    commitmentBilledC: number;
    openC: number;
    billsC: number;
    laborC: number;
    laborHours: number;
    reimbursableC: number;
    actualC: number;
    eacC: number;
    eacOverridden: boolean;
    costToCompleteC: number;
    varianceC: number;
    spentPct: number;
}
export declare function computeJobCost(i: JobCostInput): {
    rows: CostRow[];
    totals: {
        budgetOriginalC: number;
        budgetChangesC: number;
        budgetC: number;
        committedC: number;
        commitmentBilledC: number;
        openC: number;
        billsC: number;
        laborC: number;
        laborHours: number;
        reimbursableC: number;
        actualC: number;
        eacC: number;
        costToCompleteC: number;
        varianceC: number;
    };
};
export declare function profitability(p: {
    contractC: number;
    evC: number;
    contractWorkInvoicedC: number;
    actualC: number;
    eacC: number;
    reimbursablesBilledC: number;
    reimbursableCostC: number;
}): {
    contractC: number;
    projectedCostC: number;
    projectedMarginC: number;
    projectedMarginPct: number;
    costToDateC: number;
    evC: number;
    marginToDateC: number;
    marginToDatePct: number;
    costCompletePct: number;
    earnedRevenueC: number;
    billedC: number;
    overUnderBillingC: number;
    reimbursablesBilledC: number;
    reimbursableCostC: number;
    reimbursableMarginC: number;
    loss: boolean;
};
export declare const AGING_BUCKETS: readonly ["current", "d1_30", "d31_60", "d61_90", "d90_plus"];
export type AgingBucket = typeof AGING_BUCKETS[number];
export declare function agingBucket(dueDate: string | null | undefined, asOf: string): {
    bucket: AgingBucket;
    daysPastDue: number;
};
