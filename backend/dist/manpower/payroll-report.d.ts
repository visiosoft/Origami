import type { PayComponentEntity, PayrollRunEntity, PayslipEntity } from '../database/entities';
export interface ReportRow {
    key: string;
    label: string;
    sub?: string;
    payslips: number;
    earnings: Record<string, number>;
    gross: number;
    taxes: Record<string, number>;
    taxTotal: number;
    deductions: Record<string, number>;
    deductionTotal: number;
    net: number;
    paid: number;
    unpaid: number;
}
export interface PayrollReport {
    from: string;
    to: string;
    includeDrafts: boolean;
    runs: {
        id: string;
        label: string;
        periodStart: string;
        periodEnd: string;
        status: string;
        headcount: number;
    }[];
    columns: {
        earnings: string[];
        taxes: string[];
        deductions: string[];
    };
    byEmployee: ReportRow[];
    byRun: ReportRow[];
    totals: ReportRow;
}
export declare function payrollReport(runs: PayrollRunEntity[], slips: PayslipEntity[], components: PayComponentEntity[], opts: {
    from: string;
    to: string;
    employeeId?: string;
    includeDrafts?: boolean;
}): PayrollReport;
