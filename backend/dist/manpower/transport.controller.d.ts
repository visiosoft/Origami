import { ManpowerAccess } from './manpower-access.service';
import { TransportService } from './transport.service';
export declare class RouteDto {
    name?: string;
    vehicle?: string;
    capacity?: number;
    driverEmployeeId?: string;
    projectId?: number;
    departureTime?: string;
    returnTime?: string;
    pickupPoints?: string[];
    status?: string;
    notes?: string;
}
export declare class RiderDto {
    employeeId: string;
    pickupPoint?: string;
    startDate?: string;
}
export declare class RiderEndDto {
    date?: string;
}
export declare class TransportController {
    private readonly service;
    private readonly access;
    constructor(service: TransportService, access: ManpowerAccess);
    list(): Promise<{
        riders: import("../database/entities").TransportAssignmentEntity[];
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
    history(id: string): Promise<{
        route: import("../database/entities").TransportRouteEntity | undefined;
        id: string;
        routeId: string;
        employeeId: string;
        pickupPoint: string;
        startDate: string;
        endDate: string;
        byName: string;
    }[]>;
    create(dto: RouteDto, a?: string): Promise<import("../database/entities").TransportRouteEntity>;
    update(id: string, dto: RouteDto, a?: string): Promise<import("../database/entities").TransportRouteEntity>;
    remove(id: string, a?: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    addRider(id: string, dto: RiderDto, a?: string): Promise<import("../database/entities").TransportAssignmentEntity>;
    end(id: string, dto: RiderEndDto, a?: string): Promise<import("../database/entities").TransportAssignmentEntity>;
}
