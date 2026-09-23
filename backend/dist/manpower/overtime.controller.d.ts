import { ManpowerAccess } from './manpower-access.service';
import { OvertimeService } from './overtime.service';
export declare class OvertimeDto {
    employeeId: string;
    projectId?: number;
    date: string;
    hours: number;
    otType?: string;
    rate?: number;
    reason?: string;
    source?: string;
}
export declare class BulkOvertimeDto {
    items: OvertimeDto[];
}
export declare class DecisionNoteDto {
    note?: string;
}
export declare class OvertimeController {
    private readonly service;
    private readonly access;
    constructor(service: OvertimeService, access: ManpowerAccess);
    findAll(employeeId?: string, status?: string, from?: string, to?: string): Promise<import("../database/entities").OvertimeRequestEntity[]>;
    suggestions(from: string, to: string): Promise<{
        employeeId: string;
        date: string;
        loggedHours: number;
        overtimeHours: number;
        projectId: number | undefined;
        otType: string;
    }[]>;
    create(dto: OvertimeDto, auth?: string): Promise<import("../database/entities").OvertimeRequestEntity>;
    bulk(dto: BulkOvertimeDto, auth?: string): Promise<import("../database/entities").OvertimeRequestEntity[]>;
    approve(id: string, dto: DecisionNoteDto, auth?: string): Promise<import("../database/entities").OvertimeRequestEntity>;
    reject(id: string, dto: DecisionNoteDto, auth?: string): Promise<import("../database/entities").OvertimeRequestEntity>;
    cancel(id: string, auth?: string): Promise<import("../database/entities").OvertimeRequestEntity>;
}
