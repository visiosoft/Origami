import { Repository } from 'typeorm';
import { RetentionReleaseEntity } from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { FinancialsService } from './financials.service';
import { InvoicesService } from './invoices.service';
export declare const RELEASE_REASONS: string[];
export declare class RetentionService {
    private readonly repo;
    private readonly fin;
    private readonly invoices;
    constructor(repo: Repository<RetentionReleaseEntity>, fin: FinancialsService, invoices: InvoicesService);
    private load;
    private held;
    private scopeHeldC;
    overview(projectId: number, actor: Actor): Promise<any>;
    request(projectId: number, dto: {
        scope?: string;
        targetId?: string;
        amount?: number | string;
        reason?: string;
        notes?: string;
    }, actor: Actor): Promise<any>;
    decide(id: string, dto: {
        decision: 'approve' | 'reject' | 'cancel';
        reason?: string;
        version?: number;
    }, actor: Actor): Promise<any>;
    bill(id: string, actor: Actor): Promise<any>;
}
