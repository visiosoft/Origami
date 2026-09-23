import { ManpowerAccess } from './manpower-access.service';
import { AccommodationService } from './accommodation.service';
export declare class UnitDto {
    parentId?: string;
    level: string;
    name?: string;
    count?: number;
}
export declare class UnitUpdateDto {
    name?: string;
    notes?: string;
    active?: boolean;
}
export declare class AllocateDto {
    bedId: string;
    employeeId: string;
    checkIn?: string;
    notes?: string;
}
export declare class CheckoutDto {
    date?: string;
}
export declare class IssueReportDto {
    unitId: string;
    title: string;
    description?: string;
    employeeId?: string;
}
export declare class IssueUpdateDto {
    status: string;
    resolution?: string;
}
export declare class AccommodationController {
    private readonly service;
    private readonly access;
    constructor(service: AccommodationService, access: ManpowerAccess);
    overview(): Promise<{
        units: import("../database/entities").AccommodationUnitEntity[];
        allocations: import("../database/entities").BedAllocationEntity[];
        issues: import("../database/entities").AccommodationIssueEntity[];
    }>;
    history(id: string): Promise<{
        location: string;
        id: string;
        bedId: string;
        employeeId: string;
        checkIn: string;
        checkOut: string;
        notes: string;
        byName: string;
    }[]>;
    create(dto: UnitDto, a?: string): Promise<import("../database/entities").AccommodationUnitEntity | import("../database/entities").AccommodationUnitEntity[]>;
    update(id: string, dto: UnitUpdateDto, a?: string): Promise<import("../database/entities").AccommodationUnitEntity>;
    remove(id: string, a?: string): Promise<{
        id: string;
        deleted: boolean;
    } | {
        id: string;
        deleted: number;
    }>;
    allocate(dto: AllocateDto, a?: string): Promise<import("../database/entities").BedAllocationEntity>;
    checkout(id: string, dto: CheckoutDto, a?: string): Promise<import("../database/entities").BedAllocationEntity>;
    report(dto: IssueReportDto, a?: string): Promise<import("../database/entities").AccommodationIssueEntity>;
    updateIssue(id: string, dto: IssueUpdateDto, a?: string): Promise<import("../database/entities").AccommodationIssueEntity>;
}
