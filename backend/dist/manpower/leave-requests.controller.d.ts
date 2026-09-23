import { AuthService } from '../auth/auth.service';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto, DecideLeaveRequestDto } from './dto/leave-request.dto';
export declare class LeaveRequestsController {
    private readonly service;
    private readonly auth;
    constructor(service: LeaveRequestsService, auth: AuthService);
    findAll(employeeId?: string, status?: string): Promise<import("../database/entities").LeaveRequestEntity[]>;
    create(dto: CreateLeaveRequestDto, auth?: string): Promise<import("../database/entities").LeaveRequestEntity>;
    approve(id: string, dto: DecideLeaveRequestDto, auth?: string): Promise<import("../database/entities").LeaveRequestEntity>;
    deny(id: string, dto: DecideLeaveRequestDto, auth?: string): Promise<import("../database/entities").LeaveRequestEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
