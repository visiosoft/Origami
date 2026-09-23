import { Repository } from 'typeorm';
import { EmployeeAssignmentEntity, EmployeeEntity, ProjectEntity } from '../database/entities';
import type { ManpowerActor } from './daily-logs.service';
export interface AssignInput {
    employeeIds: string[];
    projectId: number;
    workArea?: string;
    startDate?: string;
    endDate?: string;
    assignmentType?: string;
    designation?: string;
    notes?: string;
    workforceRequestId?: string;
    requestLineId?: string;
}
export interface TransferInput {
    projectId: number;
    workArea?: string;
    startDate?: string;
    designation?: string;
    notes?: string;
}
export declare class AssignmentsService {
    private readonly repo;
    private readonly employees;
    private readonly projects;
    constructor(repo: Repository<EmployeeAssignmentEntity>, employees: Repository<EmployeeEntity>, projects: Repository<ProjectEntity>);
    private hydrate;
    findAll(opts: {
        employeeId?: string;
        projectId?: number;
        status?: string;
        workforceRequestId?: string;
    }): Promise<{
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
    openRegularByEmployee(): Promise<Map<string, EmployeeAssignmentEntity>>;
    private requireProject;
    private checkDates;
    assign(dto: AssignInput, actor: ManpowerActor): Promise<{
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
    private requireOpen;
    transfer(id: string, dto: TransferInput, actor: ManpowerActor): Promise<{
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
    release(id: string, dto: {
        endDate?: string;
        notes?: string;
    }, actor: ManpowerActor): Promise<{
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
    demobilize(employeeId: string, dto: {
        date?: string;
        notes?: string;
    }, actor: ManpowerActor): Promise<{
        employeeId: string;
        ended: number;
    }>;
    update(id: string, dto: {
        workArea?: string;
        designation?: string;
        endDate?: string;
        notes?: string;
    }): Promise<{
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
}
