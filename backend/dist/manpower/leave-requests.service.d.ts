import { Repository } from 'typeorm';
import { LeaveRequestEntity } from '../database/entities';
import type { ManpowerActor } from './daily-logs.service';
export declare class LeaveRequestsService {
    private readonly repo;
    constructor(repo: Repository<LeaveRequestEntity>);
    findAll(opts: {
        employeeId?: string;
        status?: string;
    }): Promise<LeaveRequestEntity[]>;
    create(dto: any, actor: ManpowerActor): Promise<LeaveRequestEntity>;
    decide(id: string, decision: 'approved' | 'denied', note: string | undefined, actor: ManpowerActor): Promise<LeaveRequestEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
