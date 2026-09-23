import { ManpowerAccess } from './manpower-access.service';
import { PayrollService } from './payroll.service';
import { PayrollSetupService } from './payroll-setup.service';
export declare class PayrollSettingsDto {
    currency?: string;
    standardDayHours?: number;
    halfDayHours?: number;
    monthDays?: number;
    otMultipliers?: Record<string, number>;
    weekendDays?: number[];
}
export declare class PayComponentDto {
    name?: string;
    kind?: string;
    calcType?: string;
    defaultValue?: number;
    appliesTo?: string;
    category?: string;
    active?: boolean;
    order?: number;
}
export declare class CreateRunDto {
    label?: string;
    periodStart: string;
    periodEnd: string;
    payGroup?: string;
    notes?: string;
}
export declare class UpdatePayslipDto {
    work?: {
        fullDays?: number;
        halfDays?: number;
        extraHours?: number;
        hoursWorked?: number;
    } | null;
    manualLines?: {
        id?: string;
        name: string;
        kind: string;
        amount: number;
        note?: string;
    }[];
    notes?: string;
}
export declare class PayDto {
    payslipIds?: string[];
    method?: string;
    ref?: string;
    date?: string;
}
export declare class VoidDto {
    reason?: string;
}
export declare class PayrollController {
    private readonly payroll;
    private readonly setup;
    private readonly access;
    constructor(payroll: PayrollService, setup: PayrollSetupService, access: ManpowerAccess);
    settings(): Promise<import("./payroll.calc").PayrollSettings>;
    saveSettings(dto: PayrollSettingsDto, auth?: string): Promise<import("./payroll.calc").PayrollSettings>;
    components(): Promise<import("../database/entities").PayComponentEntity[]>;
    createComponent(dto: PayComponentDto, auth?: string): Promise<import("../database/entities").PayComponentEntity>;
    updateComponent(id: string, dto: PayComponentDto, auth?: string): Promise<{
        id: string;
        name: string;
        kind: string;
        calcType: string;
        defaultValue: number;
        appliesTo: string;
        category: string;
        active: boolean;
        order: number;
    } & import("../database/entities").PayComponentEntity>;
    removeComponent(id: string, auth?: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    runs(): Promise<import("../database/entities").PayrollRunEntity[]>;
    run(id: string): Promise<{
        payslips: import("../database/entities").PayslipEntity[];
        id: string;
        label: string;
        periodStart: string;
        periodEnd: string;
        payGroup: string;
        status: string;
        totals: {
            headcount: number;
            gross: number;
            deductions: number;
            net: number;
            paid: number;
        };
        settingsSnapshot: Record<string, unknown>;
        notes: string;
        createdByName: string;
        createdAt: string;
        finalizedByName: string;
        finalizedAt: string;
        voidedByName: string;
        voidedAt: string;
        voidReason: string;
        updatedAt: string;
    }>;
    createRun(dto: CreateRunDto, auth?: string): Promise<{
        payslips: import("../database/entities").PayslipEntity[];
        id: string;
        label: string;
        periodStart: string;
        periodEnd: string;
        payGroup: string;
        status: string;
        totals: {
            headcount: number;
            gross: number;
            deductions: number;
            net: number;
            paid: number;
        };
        settingsSnapshot: Record<string, unknown>;
        notes: string;
        createdByName: string;
        createdAt: string;
        finalizedByName: string;
        finalizedAt: string;
        voidedByName: string;
        voidedAt: string;
        voidReason: string;
        updatedAt: string;
    }>;
    recalculate(id: string, auth?: string): Promise<{
        payslips: import("../database/entities").PayslipEntity[];
        id: string;
        label: string;
        periodStart: string;
        periodEnd: string;
        payGroup: string;
        status: string;
        totals: {
            headcount: number;
            gross: number;
            deductions: number;
            net: number;
            paid: number;
        };
        settingsSnapshot: Record<string, unknown>;
        notes: string;
        createdByName: string;
        createdAt: string;
        finalizedByName: string;
        finalizedAt: string;
        voidedByName: string;
        voidedAt: string;
        voidReason: string;
        updatedAt: string;
    }>;
    removeRun(id: string, auth?: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    finalize(id: string, auth?: string): Promise<{
        payslips: import("../database/entities").PayslipEntity[];
        id: string;
        label: string;
        periodStart: string;
        periodEnd: string;
        payGroup: string;
        status: string;
        totals: {
            headcount: number;
            gross: number;
            deductions: number;
            net: number;
            paid: number;
        };
        settingsSnapshot: Record<string, unknown>;
        notes: string;
        createdByName: string;
        createdAt: string;
        finalizedByName: string;
        finalizedAt: string;
        voidedByName: string;
        voidedAt: string;
        voidReason: string;
        updatedAt: string;
    }>;
    voidRun(id: string, dto: VoidDto, auth?: string): Promise<import("../database/entities").PayrollRunEntity>;
    pay(id: string, dto: PayDto, auth?: string): Promise<{
        payslips: import("../database/entities").PayslipEntity[];
        id: string;
        label: string;
        periodStart: string;
        periodEnd: string;
        payGroup: string;
        status: string;
        totals: {
            headcount: number;
            gross: number;
            deductions: number;
            net: number;
            paid: number;
        };
        settingsSnapshot: Record<string, unknown>;
        notes: string;
        createdByName: string;
        createdAt: string;
        finalizedByName: string;
        finalizedAt: string;
        voidedByName: string;
        voidedAt: string;
        voidReason: string;
        updatedAt: string;
    }>;
    updatePayslip(id: string, dto: UpdatePayslipDto, auth?: string): Promise<import("../database/entities").PayslipEntity>;
    employeePayslips(employeeId: string): Promise<{
        run: import("../database/entities").PayrollRunEntity | undefined;
        id: string;
        runId: string;
        employeeId: string;
        employee: Record<string, unknown>;
        basis: Record<string, unknown>;
        lines: import("../database/entities").PayLine[];
        gross: number;
        deductions: number;
        net: number;
        paymentStatus: string;
        paidAt: string;
        paymentMethod: string;
        paymentRef: string;
        paidByName: string;
        notes: string;
        updatedAt: string;
    }[]>;
}
