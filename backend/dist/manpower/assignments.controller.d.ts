import { AuthService } from '../auth/auth.service';
import { AssignmentsService } from './assignments.service';
export declare class AssignDto {
    employeeIds: string[];
    projectId: number;
    workArea?: string;
    startDate?: string;
    endDate?: string;
    assignmentType?: string;
    designation?: string;
    notes?: string;
}
export declare class TransferDto {
    projectId: number;
    workArea?: string;
    startDate?: string;
    designation?: string;
    notes?: string;
}
export declare class ReleaseDto {
    endDate?: string;
    notes?: string;
}
export declare class DemobilizeDto {
    date?: string;
    notes?: string;
}
export declare class UpdateAssignmentDto {
    workArea?: string;
    designation?: string;
    endDate?: string;
    notes?: string;
}
export declare class AssignmentsController {
    private readonly service;
    private readonly auth;
    constructor(service: AssignmentsService, auth: AuthService);
    findAll(employeeId?: string, projectId?: string, status?: string, workforceRequestId?: string): Promise<{
        current: boolean;
        id: string;
        employeeId: string;
        projectId: number;
        workArea: string;
        tradeId: string;
        designation: string;
        assignmentType: string;
        startDate: string;
        endDate: string;
        status: string;
        endReason: string;
        transferredFromId: string;
        workforceRequestId: string;
        requestLineId: string;
        notes: string;
        createdByName: string;
        endedByName: string;
        createdAt: string;
        updatedAt: string;
    }[]>;
    assign(dto: AssignDto, auth?: string): Promise<{
        current: boolean;
        id: string;
        employeeId: string;
        projectId: number;
        workArea: string;
        tradeId: string;
        designation: string;
        assignmentType: string;
        startDate: string;
        endDate: string;
        status: string;
        endReason: string;
        transferredFromId: string;
        workforceRequestId: string;
        requestLineId: string;
        notes: string;
        createdByName: string;
        endedByName: string;
        createdAt: string;
        updatedAt: string;
    }[]>;
    update(id: string, dto: UpdateAssignmentDto): Promise<{
        current: boolean;
        id: string;
        employeeId: string;
        projectId: number;
        workArea: string;
        tradeId: string;
        designation: string;
        assignmentType: string;
        startDate: string;
        endDate: string;
        status: string;
        endReason: string;
        transferredFromId: string;
        workforceRequestId: string;
        requestLineId: string;
        notes: string;
        createdByName: string;
        endedByName: string;
        createdAt: string;
        updatedAt: string;
    }>;
    transfer(id: string, dto: TransferDto, auth?: string): Promise<{
        current: boolean;
        id: string;
        employeeId: string;
        projectId: number;
        workArea: string;
        tradeId: string;
        designation: string;
        assignmentType: string;
        startDate: string;
        endDate: string;
        status: string;
        endReason: string;
        transferredFromId: string;
        workforceRequestId: string;
        requestLineId: string;
        notes: string;
        createdByName: string;
        endedByName: string;
        createdAt: string;
        updatedAt: string;
    }>;
    release(id: string, dto: ReleaseDto, auth?: string): Promise<{
        current: boolean;
        id: string;
        employeeId: string;
        projectId: number;
        workArea: string;
        tradeId: string;
        designation: string;
        assignmentType: string;
        startDate: string;
        endDate: string;
        status: string;
        endReason: string;
        transferredFromId: string;
        workforceRequestId: string;
        requestLineId: string;
        notes: string;
        createdByName: string;
        endedByName: string;
        createdAt: string;
        updatedAt: string;
    }>;
    demobilize(employeeId: string, dto: DemobilizeDto, auth?: string): Promise<{
        employeeId: string;
        ended: number;
    }>;
}
