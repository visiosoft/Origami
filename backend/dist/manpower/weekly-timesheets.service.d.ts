import { Repository } from 'typeorm';
import { EmployeeEntity, LeaveRequestEntity, PayrollRunEntity, PayslipEntity, ProjectEntity, PublicHolidayEntity, TimesheetEntity, TimesheetLineEntity, UserEntity } from '../database/entities';
import { ManpowerAccess, type Actor } from './manpower-access.service';
import { LeaveService } from './leave.service';
import { PayrollSetupService } from './payroll-setup.service';
import { TimesheetsService } from './timesheets.service';
export declare const TIMESHEET_KINDS: string[];
export declare const INTERNAL_CATEGORIES: string[];
export declare const mondayOf: (date: string) => string;
export declare const weekDates: (weekStart: string) => string[];
type SheetRepo = Pick<Repository<TimesheetEntity>, 'find'>;
type LineRepo = Pick<Repository<TimesheetLineEntity>, 'find'>;
export declare function approvedTimesheetHours(sheets: SheetRepo, lines: LineRepo, from: string, to: string, employeeIds?: Set<string>): Promise<Map<string, Map<string, {
    hours: number;
    projectIds: Set<number>;
}>>>;
interface LineDto {
    id?: string;
    kind: string;
    projectId?: number | null;
    csiCodeId?: string | null;
    category?: string | null;
    leaveTypeId?: string | null;
    description?: string | null;
    days?: Record<string, {
        hours?: number | string;
        note?: string;
    }>;
}
export declare class WeeklyTimesheetsService {
    private readonly sheets;
    private readonly lines;
    private readonly employees;
    private readonly projects;
    private readonly leaveRequests;
    private readonly holidays;
    private readonly runs;
    private readonly payslips;
    private readonly users;
    private readonly leave;
    private readonly logged;
    private readonly setup;
    private readonly access;
    constructor(sheets: Repository<TimesheetEntity>, lines: Repository<TimesheetLineEntity>, employees: Repository<EmployeeEntity>, projects: Repository<ProjectEntity>, leaveRequests: Repository<LeaveRequestEntity>, holidays: Repository<PublicHolidayEntity>, runs: Repository<PayrollRunEntity>, payslips: Repository<PayslipEntity>, users: Repository<UserEntity>, leave: LeaveService, logged: TimesheetsService, setup: PayrollSetupService, access: ManpowerAccess);
    me(actor: Actor): Promise<EmployeeEntity | null>;
    private rights;
    private employee;
    private load;
    week(employeeId: string, weekStart: string, actor: Actor): Promise<{
        employee: {
            id: string;
            name: string;
            workerId: string;
            payType: string;
            designation: string;
        };
        weekStart: string;
        dates: string[];
        sheet: TimesheetEntity | null;
        lines: TimesheetLineEntity[];
        holidays: PublicHolidayEntity[];
        otherLeave: LeaveRequestEntity[];
        logged: {
            date: string;
            projectId: number;
            projectName: string;
            csiCodeId: string;
            hours: number;
            taskDetail: string;
            status: string;
        }[];
        standardDayHours: number;
        halfDayHours: number;
        weekendDays: number[];
        canEdit: boolean;
        canReview: boolean;
        canReopen: boolean;
    }>;
    list(opts: {
        from?: string;
        to?: string;
        status?: string;
        employeeId?: string;
    }, actor: Actor): Promise<{
        lines: TimesheetLineEntity[];
        id: string;
        employeeId: string;
        weekStart: string;
        status: string;
        totalHours: number;
        notes: string;
        submittedAt: string;
        submittedById: string;
        submittedByName: string;
        decidedAt: string;
        decidedById: string;
        decidedByName: string;
        decisionNote: string;
        createdAt: string;
        updatedAt: string;
    }[]>;
    save(dto: {
        employeeId: string;
        weekStart: string;
        lines: LineDto[];
        notes?: string;
    }, actor: Actor): Promise<{
        employee: {
            id: string;
            name: string;
            workerId: string;
            payType: string;
            designation: string;
        };
        weekStart: string;
        dates: string[];
        sheet: TimesheetEntity | null;
        lines: TimesheetLineEntity[];
        holidays: PublicHolidayEntity[];
        otherLeave: LeaveRequestEntity[];
        logged: {
            date: string;
            projectId: number;
            projectName: string;
            csiCodeId: string;
            hours: number;
            taskDetail: string;
            status: string;
        }[];
        standardDayHours: number;
        halfDayHours: number;
        weekendDays: number[];
        canEdit: boolean;
        canReview: boolean;
        canReopen: boolean;
    }>;
    remove(id: string, actor: Actor): Promise<{
        id: string;
        deleted: boolean;
    }>;
    submit(id: string, actor: Actor): Promise<TimesheetEntity>;
    private linkedLeave;
    approve(id: string, note: string | undefined, actor: Actor): Promise<TimesheetEntity>;
    reject(id: string, note: string | undefined, actor: Actor): Promise<TimesheetEntity>;
    reopen(id: string, reason: string | undefined, actor: Actor): Promise<TimesheetEntity>;
    private withdrawLeave;
}
export {};
