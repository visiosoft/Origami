import type { EmployeeEntity, PayComponentEntity, PayLine } from '../database/entities';
export type OtType = 'normal' | 'weekend' | 'holiday' | 'night';
export interface PayrollSettings {
    currency: string;
    standardDayHours: number;
    halfDayHours: number;
    monthDays: number;
    otMultipliers: Record<OtType, number>;
    weekendDays: number[];
}
export declare const DEFAULT_PAYROLL_SETTINGS: PayrollSettings;
export declare const round2: (n: number) => number;
type PayEmployee = Pick<EmployeeEntity, 'payType' | 'payRate' | 'overtimeRate' | 'hireDate' | 'payComponents'>;
export declare const payGroupOf: (e: Pick<EmployeeEntity, "payType">) => "monthly" | "daily";
export declare function hourlyBase(e: PayEmployee, s: PayrollSettings): number;
export declare const overtimeBase: (e: PayEmployee, s: PayrollSettings) => number;
export declare const daysInclusive: (from: string, to: string) => number;
export interface WorkBasis {
    fullDays: number;
    halfDays: number;
    extraHours: number;
    hoursWorked: number;
    manual: boolean;
}
export declare function workFromLogs(dayHours: Record<string, number>, s: PayrollSettings): WorkBasis;
export interface DueRecovery {
    id: string;
    type: string;
    label: string;
    remaining: number;
    installmentAmount: number;
}
export interface CalcInput {
    employee: PayEmployee;
    settings: PayrollSettings;
    components: PayComponentEntity[];
    periodStart: string;
    periodEnd: string;
    work: WorkBasis;
    overtime: {
        id: string;
        hours: number;
        amount: number;
    }[];
    recoveries: DueRecovery[];
    manualLines: PayLine[];
    leave?: {
        paidDays: number;
        unpaidDays: number;
    };
    shiftAllowances?: {
        templateId: string;
        name: string;
        days: number;
        rate: number;
    }[];
    encashments?: {
        id: string;
        days: number;
        amount: number;
    }[];
}
export interface CalcResult {
    basis: Record<string, unknown>;
    lines: PayLine[];
    gross: number;
    deductions: number;
    net: number;
}
export declare function calculatePayslip(i: CalcInput): CalcResult;
export declare const ADVANCE_LABEL: Record<string, string>;
export {};
