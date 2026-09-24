import { Repository } from 'typeorm';
import { ChangeOrderEntity, ChangeOrderItemEntity, FinanceActivityEntity, PhaseFinancialEntity, ProjectEntity, ProjectFinancialEntity, ProjectInvoiceEntity, ProjectInvoiceLineEntity, ProjectPhaseEntity, ProjectTaskEntity, ReimbursableEntity, RetentionReleaseEntity, TaskFinancialEntity } from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { FinancialsService } from './financials.service';
import { CostsService } from './costs.service';
export interface Pending {
    type: 'change_order' | 'reimbursable' | 'retention_release' | 'invoice' | 'progress';
    id: string;
    projectId: number;
    projectName: string;
    title: string;
    detail: string;
    amount: number | null;
    since: string;
    canAct: boolean;
    itemKind?: string;
}
export declare class FinanceHubService {
    private readonly fin;
    private readonly projects;
    private readonly pfin;
    private readonly cos;
    private readonly coItems;
    private readonly reimbs;
    private readonly releases;
    private readonly invoices;
    private readonly phfin;
    private readonly tfin;
    private readonly phases;
    private readonly tasks;
    private readonly activity;
    private readonly lines;
    private readonly costs?;
    constructor(fin: FinancialsService, projects: Repository<ProjectEntity>, pfin: Repository<ProjectFinancialEntity>, cos: Repository<ChangeOrderEntity>, coItems: Repository<ChangeOrderItemEntity>, reimbs: Repository<ReimbursableEntity>, releases: Repository<RetentionReleaseEntity>, invoices: Repository<ProjectInvoiceEntity>, phfin: Repository<PhaseFinancialEntity>, tfin: Repository<TaskFinancialEntity>, phases: Repository<ProjectPhaseEntity>, tasks: Repository<ProjectTaskEntity>, activity: Repository<FinanceActivityEntity>, lines: Repository<ProjectInvoiceLineEntity>, costs?: CostsService | undefined);
    private names;
    pending(actor: Actor): Promise<Pending[]>;
    portfolio(actor: Actor): Promise<any[]>;
    audit(actor: Actor, q: {
        projectId?: string;
        entityType?: string;
        by?: string;
        limit?: string;
    }): Promise<{
        projectName: string;
        id: string;
        projectId: number;
        entityType: string;
        entityId: string;
        action: string;
        changes: Record<string, {
            from: unknown;
            to: unknown;
        }> | null;
        reason: string;
        byName: string;
        byId: string;
        at: string;
    }[]>;
}
