import { ManpowerAccess } from './manpower-access.service';
import { WeeklyTimesheetsService } from './weekly-timesheets.service';
export declare class TimesheetSaveDto {
    employeeId: string;
    weekStart: string;
    lines: any[];
    notes?: string;
}
export declare class TimesheetNoteDto {
    note?: string;
}
export declare class WeeklyTimesheetsController {
    private readonly service;
    private readonly access;
    constructor(service: WeeklyTimesheetsService, access: ManpowerAccess);
    me(a?: string): Promise<{
        employee: import("../database/entities").EmployeeEntity | null;
    }>;
    week(employeeId: string, weekStart: string, a?: string): Promise<{
        employee: {
            id: string;
            name: string;
            workerId: string;
            payType: string;
            designation: string;
        };
        weekStart: string;
        dates: string[];
        sheet: import("../database/entities").TimesheetEntity | null;
        lines: import("../database/entities").TimesheetLineEntity[];
        holidays: import("../database/entities").PublicHolidayEntity[];
        otherLeave: import("../database/entities").LeaveRequestEntity[];
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
    save(dto: TimesheetSaveDto, a?: string): Promise<{
        employee: {
            id: string;
            name: string;
            workerId: string;
            payType: string;
            designation: string;
        };
        weekStart: string;
        dates: string[];
        sheet: import("../database/entities").TimesheetEntity | null;
        lines: import("../database/entities").TimesheetLineEntity[];
        holidays: import("../database/entities").PublicHolidayEntity[];
        otherLeave: import("../database/entities").LeaveRequestEntity[];
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
    list(from?: string, to?: string, status?: string, employeeId?: string, a?: string): Promise<{
        lines: import("../database/entities").TimesheetLineEntity[];
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
    submit(id: string, a?: string): Promise<import("../database/entities").TimesheetEntity>;
    approve(id: string, dto: TimesheetNoteDto, a?: string): Promise<import("../database/entities").TimesheetEntity>;
    reject(id: string, dto: TimesheetNoteDto, a?: string): Promise<import("../database/entities").TimesheetEntity>;
    reopen(id: string, dto: TimesheetNoteDto, a?: string): Promise<import("../database/entities").TimesheetEntity>;
    remove(id: string, a?: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
