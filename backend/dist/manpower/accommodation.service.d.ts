import { Repository } from 'typeorm';
import { AccommodationIssueEntity, AccommodationUnitEntity, BedAllocationEntity, EmployeeEntity } from '../database/entities';
import { ManpowerAccess, type Actor } from './manpower-access.service';
export declare const LEVELS: readonly ["camp", "building", "floor", "room", "bed"];
export declare function validParent(level: string, parentLevel: string | null): boolean;
export declare class AccommodationService {
    private readonly units;
    private readonly allocations;
    private readonly issues;
    private readonly employees;
    private readonly access;
    constructor(units: Repository<AccommodationUnitEntity>, allocations: Repository<BedAllocationEntity>, issues: Repository<AccommodationIssueEntity>, employees: Repository<EmployeeEntity>, access: ManpowerAccess);
    overview(): Promise<{
        units: AccommodationUnitEntity[];
        allocations: BedAllocationEntity[];
        issues: AccommodationIssueEntity[];
    }>;
    history(employeeId: string): Promise<{
        location: string;
        id: string;
        bedId: string;
        employeeId: string;
        checkIn: string;
        checkOut: string;
        notes: string;
        byName: string;
    }[]>;
    createUnit(dto: {
        parentId?: string;
        level: string;
        name?: string;
        count?: number;
    }, actor: Actor): Promise<AccommodationUnitEntity | AccommodationUnitEntity[]>;
    updateUnit(id: string, dto: {
        name?: string;
        notes?: string;
        active?: boolean;
    }, actor: Actor): Promise<AccommodationUnitEntity>;
    private descendants;
    private occupiedBeds;
    removeUnit(id: string, actor: Actor): Promise<{
        id: string;
        deleted: boolean;
    } | {
        id: string;
        deleted: number;
    }>;
    allocate(dto: {
        bedId: string;
        employeeId: string;
        checkIn?: string;
        notes?: string;
    }, actor: Actor): Promise<BedAllocationEntity>;
    checkout(id: string, date: string | undefined, actor: Actor): Promise<BedAllocationEntity>;
    reportIssue(dto: {
        unitId: string;
        title: string;
        description?: string;
        employeeId?: string;
    }, actor: Actor): Promise<AccommodationIssueEntity>;
    updateIssue(id: string, dto: {
        status: string;
        resolution?: string;
    }, actor: Actor): Promise<AccommodationIssueEntity>;
}
