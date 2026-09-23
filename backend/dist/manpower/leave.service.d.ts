import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EmployeeEntity, LeaveAdjustmentEntity, LeaveRequestEntity, LeaveTypeEntity, PublicHolidayEntity } from '../database/entities';
import { ManpowerAccess, type Actor } from './manpower-access.service';
import { PayrollSetupService } from './payroll-setup.service';
export declare const DEFAULT_LEAVE_TYPES: Omit<LeaveTypeEntity, 'order'>[];
export declare function usFederalHolidays(year: number): {
    date: string;
    name: string;
}[];
type Req = Pick<LeaveRequestEntity, 'startDate' | 'endDate' | 'halfDay' | 'status' | 'leaveTypeId'>;
export declare function requestDaysInYear(r: Req, year: number, weekendDays: number[], holidays: Set<string>): number;
export declare function entitlementFor(type: Pick<LeaveTypeEntity, 'annualDays' | 'trackBalance'>, hireDate: string | undefined, year: number): number;
export interface Balance {
    leaveTypeId: string;
    name: string;
    trackBalance: boolean;
    paid: boolean;
    encashable: boolean;
    entitlement: number;
    carriedForward: number;
    adjusted: number;
    encashed: number;
    used: number;
    pending: number;
    available: number;
}
export declare function computeBalance(type: LeaveTypeEntity, hireDate: string | undefined, year: number, requests: Req[], adjustments: Pick<LeaveAdjustmentEntity, 'leaveTypeId' | 'year' | 'kind' | 'days'>[], weekendDays: number[], holidays: Set<string>): Balance;
export declare class LeaveService implements OnApplicationBootstrap {
    private readonly types;
    private readonly requests;
    private readonly adjustments;
    private readonly holidays;
    private readonly employees;
    private readonly setup;
    private readonly access;
    private readonly log;
    constructor(types: Repository<LeaveTypeEntity>, requests: Repository<LeaveRequestEntity>, adjustments: Repository<LeaveAdjustmentEntity>, holidays: Repository<PublicHolidayEntity>, employees: Repository<EmployeeEntity>, setup: PayrollSetupService, access: ManpowerAccess);
    onApplicationBootstrap(): Promise<void>;
    convertToUs(): Promise<void>;
    listTypes(): Promise<LeaveTypeEntity[]>;
    private checkType;
    createType(dto: Partial<LeaveTypeEntity>, actor: Actor): Promise<LeaveTypeEntity>;
    updateType(id: string, dto: Partial<LeaveTypeEntity>, actor: Actor): Promise<LeaveTypeEntity>;
    removeType(id: string, actor: Actor): Promise<{
        id: string;
        deleted: boolean;
    }>;
    listHolidays(year?: number): Promise<PublicHolidayEntity[]>;
    holidaySet(): Promise<Set<string>>;
    addHoliday(dto: {
        date: string;
        name: string;
    }, actor: Actor): Promise<PublicHolidayEntity>;
    addUsFederalHolidays(year: number, actor: Actor): Promise<{
        year: number;
        added: number;
    }>;
    removeHoliday(id: string, actor: Actor): Promise<{
        id: string;
        deleted: boolean;
    }>;
    private context;
    balances(employeeId: string, year: number): Promise<Balance[]>;
    allBalances(year: number): Promise<{
        employeeId: string;
        balances: Balance[];
    }[]>;
    adjust(dto: {
        employeeId: string;
        leaveTypeId: string;
        year: number;
        days: number;
        note?: string;
    }, actor: Actor): Promise<LeaveAdjustmentEntity>;
    private requireTrackedType;
    encash(dto: {
        employeeId: string;
        leaveTypeId: string;
        year: number;
        days: number;
    }, actor: Actor): Promise<LeaveAdjustmentEntity>;
    carryForward(fromYear: number, actor: Actor): Promise<{
        year: number;
        carried: number;
        days: number;
    }>;
    listAdjustments(employeeId: string): Promise<LeaveAdjustmentEntity[]>;
    findRequests(opts: {
        employeeId?: string;
        status?: string;
        from?: string;
        to?: string;
    }): Promise<LeaveRequestEntity[]>;
    preview(dto: {
        employeeId: string;
        leaveTypeId: string;
        startDate: string;
        endDate: string;
        halfDay?: boolean;
    }): Promise<{
        days: number;
        balances: {
            leaveTypeId: string;
            name: string;
            trackBalance: boolean;
            paid: boolean;
            encashable: boolean;
            entitlement: number;
            carriedForward: number;
            adjusted: number;
            encashed: number;
            used: number;
            pending: number;
            available: number;
            year: number;
        }[];
    }>;
    private measure;
    private assertFits;
    createRequest(dto: {
        employeeId: string;
        leaveTypeId: string;
        startDate: string;
        endDate: string;
        halfDay?: boolean;
        reason?: string;
    }, actor: Actor): Promise<LeaveRequestEntity>;
    private load;
    decide(id: string, decision: 'approved' | 'rejected', note: string | undefined, actor: Actor): Promise<LeaveRequestEntity>;
    cancel(id: string, actor: Actor): Promise<LeaveRequestEntity>;
    calendar(from: string, to: string): Promise<{
        requests: LeaveRequestEntity[];
        holidays: PublicHolidayEntity[];
    }>;
}
export {};
