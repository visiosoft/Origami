import { EntityManager, Repository } from 'typeorm';
import { ProjectFinancialEntity, ProjectInvoiceEntity, ProjectInvoiceLineEntity, ProjectPaymentEntity, ReimbursableEntity, RetentionReleaseEntity } from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { type TaskAttachment } from '../database/task.types';
import { computeSov, type SovRow } from './finance.calc';
import { FinancialsService } from './financials.service';
export declare const PAYMENT_METHODS: string[];
interface LineDto {
    id?: string;
    kind: string;
    targetType?: string | null;
    phaseId?: string | null;
    taskId?: string | null;
    description?: string;
    amount?: number | string | null;
    currentProgressPct?: number | string | null;
    quantity?: number | string | null;
    unit?: string | null;
    rate?: number | string | null;
    retentionApplies?: boolean;
    taxable?: boolean;
    reimbursableId?: string | null;
    retentionReleaseId?: string | null;
}
export declare function billableItems(sov: ReturnType<typeof computeSov>): SovRow[];
export declare const itemKey: (x: {
    targetType?: string | null;
    kind?: string;
    phaseId?: string | null;
    taskId?: string | null;
    id?: string;
}) => string;
export declare const reimbursableBillC: (r: {
    cost: number;
    markupPct: number;
}) => number;
export declare class InvoicesService {
    private readonly invoices;
    private readonly lines;
    private readonly payments;
    private readonly pfin;
    private readonly fin;
    private readonly reimbs;
    private readonly releases;
    private readonly attachments?;
    constructor(invoices: Repository<ProjectInvoiceEntity>, lines: Repository<ProjectInvoiceLineEntity>, payments: Repository<ProjectPaymentEntity>, pfin: Repository<ProjectFinancialEntity>, fin: FinancialsService, reimbs: Repository<ReimbursableEntity>, releases: Repository<RetentionReleaseEntity>, attachments?: AttachmentsService | undefined);
    private load;
    private totalsOf;
    private present;
    list(projectId: number, actor: Actor): Promise<any[]>;
    get(id: string, actor: Actor): Promise<any>;
    projectPayments(projectId: number, actor: Actor): Promise<{
        invoiceNumber: string | undefined;
        id: string;
        invoiceId: string;
        projectId: number;
        date: string;
        amount: number;
        currency: string;
        fxRate: number;
        method: string;
        bankRef: string;
        txnRef: string;
        notes: string;
        attachments: TaskAttachment[];
        voidedAt: string;
        voidedByName: string;
        voidReason: string;
        createdAt: string;
        createdBy: string;
        updatedAt: string;
        updatedBy: string;
        version: number;
    }[]>;
    private refs;
    createDraft(projectId: number, dto: {
        items?: {
            kind: string;
            id: string;
        }[];
        billReady?: boolean;
        kind?: string;
        description?: string;
        reimbursableIds?: string[];
    }, actor: Actor): Promise<any>;
    private buildLines;
    createReleaseDraft(rel: RetentionReleaseEntity, dtos: LineDto[], actor: Actor): Promise<any>;
    private asDtos;
    updateDraft(id: string, dto: any, actor: Actor): Promise<any>;
    removeDraft(id: string, actor: Actor): Promise<{
        id: string;
        deleted: boolean;
    }>;
    requestApproval(id: string, dto: {
        version?: number;
        comment?: string;
    }, actor: Actor): Promise<any>;
    returnDraft(id: string, dto: {
        version?: number;
        comment?: string;
    }, actor: Actor): Promise<any>;
    nextNumber(m: EntityManager, year: number, prefix?: string): Promise<string>;
    issue(id: string, dto: {
        version?: number;
    }, actor: Actor): Promise<any>;
    void(id: string, dto: {
        reason?: string;
        version?: number;
    }, actor: Actor): Promise<any>;
    private creditRoom;
    private owedC;
    createCredit(invoiceId: string, dto: {
        creditType?: string;
        reason?: string;
        amount?: number | string;
        lines?: {
            lineId: string;
            amount: number | string;
        }[];
    }, actor: Actor): Promise<any>;
    private creditLines;
    private issueCredit;
    recordPayment(invoiceId: string, dto: {
        date?: string;
        amount: number | string;
        method?: string;
        bankRef?: string;
        txnRef?: string;
        notes?: string;
    }, actor: Actor): Promise<any>;
    voidPayment(id: string, dto: {
        reason?: string;
        version?: number;
    }, actor: Actor): Promise<any>;
    addAttachments(id: string, files: any[], actor: UploadActor): Promise<TaskAttachment[]>;
    addLink(id: string, name: string, url: string, actor: UploadActor): Promise<TaskAttachment[]>;
    removeAttachment(id: string, attId: string): Promise<TaskAttachment[]>;
    attachment(id: string, attId: string): Promise<TaskAttachment>;
}
export {};
