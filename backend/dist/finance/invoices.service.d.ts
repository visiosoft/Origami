import { EntityManager, Repository } from 'typeorm';
import { ProjectFinancialEntity, ProjectInvoiceEntity, ProjectInvoiceLineEntity, ProjectPaymentEntity } from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { type TaskAttachment } from '../database/task.types';
import { FinancialsService } from './financials.service';
export declare const PAYMENT_METHODS: string[];
export declare class InvoicesService {
    private readonly invoices;
    private readonly lines;
    private readonly payments;
    private readonly pfin;
    private readonly fin;
    private readonly attachments?;
    constructor(invoices: Repository<ProjectInvoiceEntity>, lines: Repository<ProjectInvoiceLineEntity>, payments: Repository<ProjectPaymentEntity>, pfin: Repository<ProjectFinancialEntity>, fin: FinancialsService, attachments?: AttachmentsService | undefined);
    private load;
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
    private need;
    createDraft(projectId: number, dto: {
        items?: {
            kind: string;
            id: string;
        }[];
        billReady?: boolean;
        kind?: string;
        description?: string;
    }, actor: Actor): Promise<any>;
    private buildLines;
    updateDraft(id: string, dto: any, actor: Actor): Promise<any>;
    removeDraft(id: string, actor: Actor): Promise<{
        id: string;
        deleted: boolean;
    }>;
    nextNumber(m: EntityManager, year: number): Promise<string>;
    issue(id: string, dto: {
        version?: number;
    }, actor: Actor): Promise<any>;
    void(id: string, dto: {
        reason?: string;
        version?: number;
    }, actor: Actor): Promise<any>;
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
