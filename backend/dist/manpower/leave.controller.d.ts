import { ManpowerAccess } from './manpower-access.service';
import { LeaveService } from './leave.service';
export declare class LeaveTypeDto {
    name?: string;
    paid?: boolean;
    trackBalance?: boolean;
    annualDays?: number;
    carryForwardMax?: number;
    encashable?: boolean;
    color?: string;
    active?: boolean;
    order?: number;
}
export declare class HolidayDto {
    date: string;
    name: string;
}
export declare class LeaveRequestDto {
    employeeId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    halfDay?: boolean;
    reason?: string;
}
export declare class NoteDto {
    note?: string;
}
export declare class AdjustDto {
    employeeId: string;
    leaveTypeId: string;
    year: number;
    days: number;
    note?: string;
}
export declare class CarryForwardDto {
    fromYear: number;
}
export declare class YearDto {
    year: number;
}
export declare class LeaveController {
    private readonly service;
    private readonly access;
    constructor(service: LeaveService, access: ManpowerAccess);
    private actor;
    types(): Promise<import("../database/entities").LeaveTypeEntity[]>;
    createType(dto: LeaveTypeDto, a?: string): Promise<import("../database/entities").LeaveTypeEntity>;
    updateType(id: string, dto: LeaveTypeDto, a?: string): Promise<import("../database/entities").LeaveTypeEntity>;
    removeType(id: string, a?: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    holidays(year?: string): Promise<import("../database/entities").PublicHolidayEntity[]>;
    addHoliday(dto: HolidayDto, a?: string): Promise<import("../database/entities").PublicHolidayEntity>;
    usFederal(dto: YearDto, a?: string): Promise<{
        year: number;
        added: number;
    }>;
    removeHoliday(id: string, a?: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    requests(employeeId?: string, status?: string, from?: string, to?: string): Promise<import("../database/entities").LeaveRequestEntity[]>;
    preview(dto: LeaveRequestDto): Promise<{
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
    create(dto: LeaveRequestDto, a?: string): Promise<import("../database/entities").LeaveRequestEntity>;
    approve(id: string, dto: NoteDto, a?: string): Promise<import("../database/entities").LeaveRequestEntity>;
    reject(id: string, dto: NoteDto, a?: string): Promise<import("../database/entities").LeaveRequestEntity>;
    cancel(id: string, a?: string): Promise<import("../database/entities").LeaveRequestEntity>;
    balances(employeeId: string | undefined, year: string): Promise<import("./leave.service").Balance[]> | Promise<{
        employeeId: string;
        balances: import("./leave.service").Balance[];
    }[]>;
    adjustments(employeeId: string): Promise<import("../database/entities").LeaveAdjustmentEntity[]>;
    adjust(dto: AdjustDto, a?: string): Promise<import("../database/entities").LeaveAdjustmentEntity>;
    encash(dto: AdjustDto, a?: string): Promise<import("../database/entities").LeaveAdjustmentEntity>;
    carryForward(dto: CarryForwardDto, a?: string): Promise<{
        year: number;
        carried: number;
        days: number;
    }>;
    calendar(from: string, to: string): Promise<{
        requests: import("../database/entities").LeaveRequestEntity[];
        holidays: import("../database/entities").PublicHolidayEntity[];
    }>;
}
