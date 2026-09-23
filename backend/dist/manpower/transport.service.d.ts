import { Repository } from 'typeorm';
import { EmployeeEntity, ProjectEntity, TransportAssignmentEntity, TransportRouteEntity } from '../database/entities';
import { ManpowerAccess, type Actor } from './manpower-access.service';
export declare class TransportService {
    private readonly routes;
    private readonly riders;
    private readonly employees;
    private readonly projects;
    private readonly access;
    constructor(routes: Repository<TransportRouteEntity>, riders: Repository<TransportAssignmentEntity>, employees: Repository<EmployeeEntity>, projects: Repository<ProjectEntity>, access: ManpowerAccess);
    list(): Promise<{
        riders: TransportAssignmentEntity[];
        riderCount: number;
        id: string;
        name: string;
        vehicle: string;
        capacity: number;
        driverEmployeeId: string;
        projectId: number;
        departureTime: string;
        returnTime: string;
        pickupPoints: string[];
        status: string;
        notes: string;
        createdAt: string;
    }[]>;
    history(employeeId: string): Promise<{
        route: TransportRouteEntity | undefined;
        id: string;
        routeId: string;
        employeeId: string;
        pickupPoint: string;
        startDate: string;
        endDate: string;
        byName: string;
    }[]>;
    private check;
    create(dto: Partial<TransportRouteEntity>, actor: Actor): Promise<TransportRouteEntity>;
    update(id: string, dto: Partial<TransportRouteEntity>, actor: Actor): Promise<TransportRouteEntity>;
    remove(id: string, actor: Actor): Promise<{
        id: string;
        deleted: boolean;
    }>;
    addRider(routeId: string, dto: {
        employeeId: string;
        pickupPoint?: string;
        startDate?: string;
    }, actor: Actor): Promise<TransportAssignmentEntity>;
    endRider(id: string, date: string | undefined, actor: Actor): Promise<TransportAssignmentEntity>;
}
