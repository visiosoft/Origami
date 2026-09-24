import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService } from '../google/attachments.service';
import { AddLinkDto } from '../tasks/dto/update-task.dto';
import { ManpowerAccess } from '../manpower/manpower-access.service';
import { FinancialsService } from './financials.service';
import { InvoicesService } from './invoices.service';
export declare class FinanceController {
    private readonly fin;
    private readonly invoices;
    private readonly access;
    constructor(fin: FinancialsService, invoices: InvoicesService, access: ManpowerAccess);
    private actor;
    rights(a?: string): Promise<{
        view: boolean;
        manage: boolean;
        reportProgress: boolean;
        approveProgress: boolean;
    }>;
    brand(a?: string): Promise<{
        companyName: string;
        tagline: string;
        logoDataUrl: string;
        accentColor: string;
        address: string;
        phone: string;
        email: string;
        website: string;
        footerNote: string;
    }>;
    overview(id: string, a?: string): Promise<{
        project: {
            id: number;
            name: string;
            contractAmt: string;
            stage: string;
        };
        settings: {
            exists: boolean;
            projectId: number;
            currency: string;
            fxRate: number;
            originalContractValue: number;
            originalBudget: number | null;
            retentionPct: number;
            taxPct: number;
            paymentTermsDays: number;
            requireProgressApproval: boolean;
            billToName: string;
            billToEmail: string;
            billToAddress: string;
            contractNumber: string;
            poNumber: string;
            notes: string;
            contractLockedAt: string;
            reportedProgress: number;
            approvedProgress: number;
            createdAt: string;
            createdBy: string;
            updatedAt: string;
            updatedBy: string;
            version: number;
        };
        billToDefaults: {
            name: string;
            email: string;
            address: string;
        } | null;
        suggestedContract: number;
        sov: any;
        drafts: number;
        rights: {
            view: boolean;
            manage: boolean;
            reportProgress: boolean;
            approveProgress: boolean;
        };
        looseTasks: {
            id: string;
            title: string;
        }[];
    }>;
    settings(id: string, dto: any, a?: string): Promise<{
        project: {
            id: number;
            name: string;
            contractAmt: string;
            stage: string;
        };
        settings: {
            exists: boolean;
            projectId: number;
            currency: string;
            fxRate: number;
            originalContractValue: number;
            originalBudget: number | null;
            retentionPct: number;
            taxPct: number;
            paymentTermsDays: number;
            requireProgressApproval: boolean;
            billToName: string;
            billToEmail: string;
            billToAddress: string;
            contractNumber: string;
            poNumber: string;
            notes: string;
            contractLockedAt: string;
            reportedProgress: number;
            approvedProgress: number;
            createdAt: string;
            createdBy: string;
            updatedAt: string;
            updatedBy: string;
            version: number;
        };
        billToDefaults: {
            name: string;
            email: string;
            address: string;
        } | null;
        suggestedContract: number;
        sov: any;
        drafts: number;
        rights: {
            view: boolean;
            manage: boolean;
            reportProgress: boolean;
            approveProgress: boolean;
        };
        looseTasks: {
            id: string;
            title: string;
        }[];
    }>;
    milestone(id: string, dto: any, a?: string): Promise<{
        project: {
            id: number;
            name: string;
            contractAmt: string;
            stage: string;
        };
        settings: {
            exists: boolean;
            projectId: number;
            currency: string;
            fxRate: number;
            originalContractValue: number;
            originalBudget: number | null;
            retentionPct: number;
            taxPct: number;
            paymentTermsDays: number;
            requireProgressApproval: boolean;
            billToName: string;
            billToEmail: string;
            billToAddress: string;
            contractNumber: string;
            poNumber: string;
            notes: string;
            contractLockedAt: string;
            reportedProgress: number;
            approvedProgress: number;
            createdAt: string;
            createdBy: string;
            updatedAt: string;
            updatedBy: string;
            version: number;
        };
        billToDefaults: {
            name: string;
            email: string;
            address: string;
        } | null;
        suggestedContract: number;
        sov: any;
        drafts: number;
        rights: {
            view: boolean;
            manage: boolean;
            reportProgress: boolean;
            approveProgress: boolean;
        };
        looseTasks: {
            id: string;
            title: string;
        }[];
    }>;
    activity(id: string, a?: string): Promise<import("../database/entities").FinanceActivityEntity[]>;
    invoiceList(id: string, a?: string): Promise<any[]>;
    draft(id: string, dto: any, a?: string): Promise<any>;
    payments(id: string, a?: string): Promise<{
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
        attachments: import("../database/task.types").TaskAttachment[];
        voidedAt: string;
        voidedByName: string;
        voidReason: string;
        createdAt: string;
        createdBy: string;
        updatedAt: string;
        updatedBy: string;
        version: number;
    }[]>;
    item(kind: string, id: string, dto: any, a?: string): Promise<{
        project: {
            id: number;
            name: string;
            contractAmt: string;
            stage: string;
        };
        settings: {
            exists: boolean;
            projectId: number;
            currency: string;
            fxRate: number;
            originalContractValue: number;
            originalBudget: number | null;
            retentionPct: number;
            taxPct: number;
            paymentTermsDays: number;
            requireProgressApproval: boolean;
            billToName: string;
            billToEmail: string;
            billToAddress: string;
            contractNumber: string;
            poNumber: string;
            notes: string;
            contractLockedAt: string;
            reportedProgress: number;
            approvedProgress: number;
            createdAt: string;
            createdBy: string;
            updatedAt: string;
            updatedBy: string;
            version: number;
        };
        billToDefaults: {
            name: string;
            email: string;
            address: string;
        } | null;
        suggestedContract: number;
        sov: any;
        drafts: number;
        rights: {
            view: boolean;
            manage: boolean;
            reportProgress: boolean;
            approveProgress: boolean;
        };
        looseTasks: {
            id: string;
            title: string;
        }[];
    }>;
    progress(kind: string, id: string, dto: any, a?: string): Promise<{
        project: {
            id: number;
            name: string;
            contractAmt: string;
            stage: string;
        };
        settings: {
            exists: boolean;
            projectId: number;
            currency: string;
            fxRate: number;
            originalContractValue: number;
            originalBudget: number | null;
            retentionPct: number;
            taxPct: number;
            paymentTermsDays: number;
            requireProgressApproval: boolean;
            billToName: string;
            billToEmail: string;
            billToAddress: string;
            contractNumber: string;
            poNumber: string;
            notes: string;
            contractLockedAt: string;
            reportedProgress: number;
            approvedProgress: number;
            createdAt: string;
            createdBy: string;
            updatedAt: string;
            updatedBy: string;
            version: number;
        };
        billToDefaults: {
            name: string;
            email: string;
            address: string;
        } | null;
        suggestedContract: number;
        sov: any;
        drafts: number;
        rights: {
            view: boolean;
            manage: boolean;
            reportProgress: boolean;
            approveProgress: boolean;
        };
        looseTasks: {
            id: string;
            title: string;
        }[];
    }>;
    approve(kind: string, id: string, dto: any, a?: string): Promise<{
        project: {
            id: number;
            name: string;
            contractAmt: string;
            stage: string;
        };
        settings: {
            exists: boolean;
            projectId: number;
            currency: string;
            fxRate: number;
            originalContractValue: number;
            originalBudget: number | null;
            retentionPct: number;
            taxPct: number;
            paymentTermsDays: number;
            requireProgressApproval: boolean;
            billToName: string;
            billToEmail: string;
            billToAddress: string;
            contractNumber: string;
            poNumber: string;
            notes: string;
            contractLockedAt: string;
            reportedProgress: number;
            approvedProgress: number;
            createdAt: string;
            createdBy: string;
            updatedAt: string;
            updatedBy: string;
            version: number;
        };
        billToDefaults: {
            name: string;
            email: string;
            address: string;
        } | null;
        suggestedContract: number;
        sov: any;
        drafts: number;
        rights: {
            view: boolean;
            manage: boolean;
            reportProgress: boolean;
            approveProgress: boolean;
        };
        looseTasks: {
            id: string;
            title: string;
        }[];
    }>;
    history(kind: string, id: string, a?: string): Promise<import("../database/entities").ProgressUpdateEntity[]>;
    itemInvoices(kind: string, id: string, a?: string): Promise<{
        invoiceId: string;
        number: string;
        status: string;
        invoiceDate: string;
        description: string;
        amount: number;
        retention: number;
        net: number;
        prevProgressPct: number | null;
        currentProgressPct: number | null;
    }[]>;
    invoice(id: string, a?: string): Promise<any>;
    updateDraft(id: string, dto: any, a?: string): Promise<any>;
    removeDraft(id: string, a?: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    issue(id: string, dto: any, a?: string): Promise<any>;
    void(id: string, dto: any, a?: string): Promise<any>;
    pay(id: string, dto: any, a?: string): Promise<any>;
    voidPayment(id: string, dto: any, a?: string): Promise<any>;
}
export declare class FinanceInvoiceFilesController {
    private readonly invoices;
    private readonly fin;
    private readonly auth;
    private readonly attachments;
    private readonly access;
    constructor(invoices: InvoicesService, fin: FinancialsService, auth: AuthService, attachments: AttachmentsService, access: ManpowerAccess);
    private manage;
    upload(id: string, files: any[], a?: string): Promise<import("../database/task.types").TaskAttachment[]>;
    link(id: string, dto: AddLinkDto, a?: string): Promise<import("../database/task.types").TaskAttachment[]>;
    remove(id: string, attId: string, a?: string): Promise<import("../database/task.types").TaskAttachment[]>;
    content(id: string, attId: string, thumb: string, res: Response): Promise<void>;
}
