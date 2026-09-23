import { Repository } from 'typeorm';
import { EmployeeAssignmentEntity, EmployeeEntity, ProjectEntity, TradeEntity, WorkforceRequestEntity, type WorkforceRequestLine } from '../database/entities';
import { AssignmentsService } from './assignments.service';
import type { ManpowerActor } from './daily-logs.service';
export interface LineSummary extends WorkforceRequestLine {
    allocated: number;
    available: number;
    shortage: number;
    surplus: number;
}
export declare function summarizeLines(request: Pick<WorkforceRequestEntity, 'id' | 'lines'>, employees: EmployeeEntity[], openRegular: Map<string, unknown>, openAssignments: EmployeeAssignmentEntity[]): LineSummary[];
export declare class WorkforceRequestsService {
    private readonly repo;
    private readonly employees;
    private readonly assignmentsRepo;
    private readonly projects;
    private readonly trades;
    private readonly assignments;
    constructor(repo: Repository<WorkforceRequestEntity>, employees: Repository<EmployeeEntity>, assignmentsRepo: Repository<EmployeeAssignmentEntity>, projects: Repository<ProjectEntity>, trades: Repository<TradeEntity>, assignments: AssignmentsService);
    private context;
    private withSummary;
    findAll(opts: {
        projectId?: number;
        status?: string;
    }): Promise<{
        lines: LineSummary[];
        totals: {
            required: number;
            allocated: number;
            shortage: number;
        };
        id: string;
        projectId: number;
        workArea: string;
        requiredDate: string;
        durationDays: number;
        notes: string;
        status: string;
        requestedById: string;
        requestedByName: string;
        submittedAt: string;
        decidedByName: string;
        decidedAt: string;
        decisionNote: string;
        createdAt: string;
        updatedAt: string;
    }[]>;
    findOne(id: string): Promise<{
        lines: LineSummary[];
        totals: {
            required: number;
            allocated: number;
            shortage: number;
        };
        id: string;
        projectId: number;
        workArea: string;
        requiredDate: string;
        durationDays: number;
        notes: string;
        status: string;
        requestedById: string;
        requestedByName: string;
        submittedAt: string;
        decidedByName: string;
        decidedAt: string;
        decisionNote: string;
        createdAt: string;
        updatedAt: string;
    }>;
    private load;
    private cleanLines;
    create(dto: any, actor: ManpowerActor): Promise<{
        lines: LineSummary[];
        totals: {
            required: number;
            allocated: number;
            shortage: number;
        };
        id: string;
        projectId: number;
        workArea: string;
        requiredDate: string;
        durationDays: number;
        notes: string;
        status: string;
        requestedById: string;
        requestedByName: string;
        submittedAt: string;
        decidedByName: string;
        decidedAt: string;
        decisionNote: string;
        createdAt: string;
        updatedAt: string;
    }>;
    update(id: string, dto: any): Promise<{
        lines: LineSummary[];
        totals: {
            required: number;
            allocated: number;
            shortage: number;
        };
        id: string;
        projectId: number;
        workArea: string;
        requiredDate: string;
        durationDays: number;
        notes: string;
        status: string;
        requestedById: string;
        requestedByName: string;
        submittedAt: string;
        decidedByName: string;
        decidedAt: string;
        decisionNote: string;
        createdAt: string;
        updatedAt: string;
    }>;
    private transition;
    submit(id: string): Promise<{
        lines: LineSummary[];
        totals: {
            required: number;
            allocated: number;
            shortage: number;
        };
        id: string;
        projectId: number;
        workArea: string;
        requiredDate: string;
        durationDays: number;
        notes: string;
        status: string;
        requestedById: string;
        requestedByName: string;
        submittedAt: string;
        decidedByName: string;
        decidedAt: string;
        decisionNote: string;
        createdAt: string;
        updatedAt: string;
    }>;
    approve(id: string, note: string | undefined, actor: ManpowerActor): Promise<{
        lines: LineSummary[];
        totals: {
            required: number;
            allocated: number;
            shortage: number;
        };
        id: string;
        projectId: number;
        workArea: string;
        requiredDate: string;
        durationDays: number;
        notes: string;
        status: string;
        requestedById: string;
        requestedByName: string;
        submittedAt: string;
        decidedByName: string;
        decidedAt: string;
        decisionNote: string;
        createdAt: string;
        updatedAt: string;
    }>;
    reject(id: string, note: string | undefined, actor: ManpowerActor): Promise<{
        lines: LineSummary[];
        totals: {
            required: number;
            allocated: number;
            shortage: number;
        };
        id: string;
        projectId: number;
        workArea: string;
        requiredDate: string;
        durationDays: number;
        notes: string;
        status: string;
        requestedById: string;
        requestedByName: string;
        submittedAt: string;
        decidedByName: string;
        decidedAt: string;
        decisionNote: string;
        createdAt: string;
        updatedAt: string;
    }>;
    cancel(id: string, actor: ManpowerActor): Promise<{
        lines: LineSummary[];
        totals: {
            required: number;
            allocated: number;
            shortage: number;
        };
        id: string;
        projectId: number;
        workArea: string;
        requiredDate: string;
        durationDays: number;
        notes: string;
        status: string;
        requestedById: string;
        requestedByName: string;
        submittedAt: string;
        decidedByName: string;
        decidedAt: string;
        decisionNote: string;
        createdAt: string;
        updatedAt: string;
    }>;
    fulfill(id: string, actor: ManpowerActor): Promise<{
        lines: LineSummary[];
        totals: {
            required: number;
            allocated: number;
            shortage: number;
        };
        id: string;
        projectId: number;
        workArea: string;
        requiredDate: string;
        durationDays: number;
        notes: string;
        status: string;
        requestedById: string;
        requestedByName: string;
        submittedAt: string;
        decidedByName: string;
        decidedAt: string;
        decisionNote: string;
        createdAt: string;
        updatedAt: string;
    }>;
    allocate(id: string, dto: {
        lineId: string;
        employeeIds: string[];
        startDate?: string;
        workArea?: string;
    }, actor: ManpowerActor): Promise<{
        lines: LineSummary[];
        totals: {
            required: number;
            allocated: number;
            shortage: number;
        };
        id: string;
        projectId: number;
        workArea: string;
        requiredDate: string;
        durationDays: number;
        notes: string;
        status: string;
        requestedById: string;
        requestedByName: string;
        submittedAt: string;
        decidedByName: string;
        decidedAt: string;
        decisionNote: string;
        createdAt: string;
        updatedAt: string;
    }>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
