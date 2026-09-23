import { ManpowerAccess } from './manpower-access.service';
import { ShiftsService } from './shifts.service';
export declare class ShiftTemplateDto {
    name?: string;
    code?: string;
    kind?: string;
    startTime?: string;
    endTime?: string;
    allowancePerDay?: number;
    color?: string;
    active?: boolean;
    order?: number;
}
export declare class ShiftAssignDto {
    employeeIds: string[];
    templateIds: string[];
    rotateEveryDays?: number;
    startDate: string;
    endDate?: string;
    notes?: string;
}
export declare class EndDto {
    endDate?: string;
}
export declare class ShiftsController {
    private readonly service;
    private readonly access;
    constructor(service: ShiftsService, access: ManpowerAccess);
    templates(): Promise<import("../database/entities").ShiftTemplateEntity[]>;
    create(dto: ShiftTemplateDto, a?: string): Promise<import("../database/entities").ShiftTemplateEntity>;
    update(id: string, dto: ShiftTemplateDto, a?: string): Promise<import("../database/entities").ShiftTemplateEntity>;
    removeTemplate(id: string, a?: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    assignments(employeeId?: string, from?: string, to?: string): Promise<import("../database/entities").ShiftAssignmentEntity[]>;
    assign(dto: ShiftAssignDto, a?: string): Promise<import("../database/entities").ShiftAssignmentEntity[]>;
    end(id: string, dto: EndDto, a?: string): Promise<import("../database/entities").ShiftAssignmentEntity>;
    remove(id: string, a?: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
