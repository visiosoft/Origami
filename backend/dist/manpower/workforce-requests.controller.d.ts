import { AuthService } from '../auth/auth.service';
import { WorkforceRequestsService } from './workforce-requests.service';
export declare class WorkforceRequestDto {
    projectId?: number;
    workArea?: string;
    requiredDate?: string;
    durationDays?: number;
    lines?: {
        id?: string;
        tradeId: string;
        designation?: string;
        quantity: number;
    }[];
    notes?: string;
    submit?: boolean;
}
export declare class DecisionDto {
    note?: string;
}
export declare class AllocateDto {
    lineId: string;
    employeeIds: string[];
    startDate?: string;
    workArea?: string;
}
export declare class WorkforceRequestsController {
    private readonly service;
    private readonly auth;
    constructor(service: WorkforceRequestsService, auth: AuthService);
    findAll(projectId?: string, status?: string): Promise<{
        lines: import("./workforce-requests.service").LineSummary[];
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
        lines: import("./workforce-requests.service").LineSummary[];
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
    create(dto: WorkforceRequestDto, auth?: string): Promise<{
        lines: import("./workforce-requests.service").LineSummary[];
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
    update(id: string, dto: WorkforceRequestDto): Promise<{
        lines: import("./workforce-requests.service").LineSummary[];
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
    submit(id: string): Promise<{
        lines: import("./workforce-requests.service").LineSummary[];
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
    approve(id: string, dto: DecisionDto, auth?: string): Promise<{
        lines: import("./workforce-requests.service").LineSummary[];
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
    reject(id: string, dto: DecisionDto, auth?: string): Promise<{
        lines: import("./workforce-requests.service").LineSummary[];
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
    cancel(id: string, auth?: string): Promise<{
        lines: import("./workforce-requests.service").LineSummary[];
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
    fulfill(id: string, auth?: string): Promise<{
        lines: import("./workforce-requests.service").LineSummary[];
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
    allocate(id: string, dto: AllocateDto, auth?: string): Promise<{
        lines: import("./workforce-requests.service").LineSummary[];
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
}
