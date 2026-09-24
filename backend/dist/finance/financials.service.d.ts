import { EntityManager, Repository } from 'typeorm';
import { FinanceActivityEntity, LeadEntity, PhaseFinancialEntity, ProgressUpdateEntity, ProjectEntity, ProjectFinancialEntity, ProjectInvoiceEntity, ProjectInvoiceLineEntity, ProjectPaymentEntity, ProjectPhaseEntity, ProjectTaskEntity, TaskFinancialEntity } from '../database/entities';
import { ManpowerAccess, type Actor } from '../manpower/manpower-access.service';
import { SettingsService } from '../settings/settings.service';
import { type Category, type SovInput } from './finance.calc';
export declare const FIN_MODULE = "fin_project";
export declare const PM_MODULE = "pm";
export declare const BILLING_METHODS: string[];
type ItemKind = 'project' | 'phase' | 'task';
export declare function assertVersion(row: {
    version?: number;
    updatedBy?: string;
} | null | undefined, version: unknown): void;
export declare class FinancialsService {
    private readonly projects;
    private readonly leads;
    private readonly phases;
    private readonly tasks;
    private readonly pfin;
    private readonly phfin;
    private readonly tfin;
    private readonly progress;
    private readonly invoices;
    private readonly lines;
    private readonly payments;
    private readonly activityRepo;
    private readonly settings;
    readonly access: ManpowerAccess;
    constructor(projects: Repository<ProjectEntity>, leads: Repository<LeadEntity>, phases: Repository<ProjectPhaseEntity>, tasks: Repository<ProjectTaskEntity>, pfin: Repository<ProjectFinancialEntity>, phfin: Repository<PhaseFinancialEntity>, tfin: Repository<TaskFinancialEntity>, progress: Repository<ProgressUpdateEntity>, invoices: Repository<ProjectInvoiceEntity>, lines: Repository<ProjectInvoiceLineEntity>, payments: Repository<ProjectPaymentEntity>, activityRepo: Repository<FinanceActivityEntity>, settings: SettingsService, access: ManpowerAccess);
    rights(actor: Actor): Promise<{
        view: boolean;
        manage: boolean;
        reportProgress: boolean;
        approveProgress: boolean;
    }>;
    private need;
    log(m: EntityManager | null, e: {
        projectId: number;
        entityType: string;
        entityId: string;
        action: string;
        changes?: Record<string, {
            from: unknown;
            to: unknown;
        }> | null;
        reason?: string;
    }, actor: Actor): Promise<void>;
    private diff;
    private library;
    categories(project: ProjectEntity): Promise<(key: string) => Category>;
    project(projectId: number): Promise<ProjectEntity>;
    settingsFor(projectId: number): Promise<{
        row: ProjectFinancialEntity | null;
        exists: boolean;
        value: ProjectFinancialEntity;
    }>;
    context(projectId: number): Promise<{
        input: SovInput;
        settings: ProjectFinancialEntity;
        exists: boolean;
        phaseRows: ProjectPhaseEntity[];
        taskRows: ProjectTaskEntity[];
    }>;
    overview(projectId: number, actor: Actor): Promise<{
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
    saveSettings(projectId: number, dto: any, actor: Actor): Promise<{
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
    private target;
    private finRepo;
    private finRow;
    updateItem(kind: 'phase' | 'task', id: string, dto: any, actor: Actor): Promise<{
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
    reportProgress(kind: ItemKind, id: string, dto: {
        pct: number;
        reason?: string;
        version?: number;
    }, actor: Actor, projectIdForLump?: number): Promise<{
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
    approveProgress(kind: ItemKind, id: string, dto: {
        pct?: number;
        reason?: string;
        version?: number;
    }, actor: Actor, projectIdForLump?: number): Promise<{
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
    private changeProgress;
    progressHistory(kind: ItemKind, id: string, actor: Actor): Promise<ProgressUpdateEntity[]>;
    addMilestone(projectId: number, dto: {
        name: string;
        contractValue?: number | null;
    }, actor: Actor): Promise<{
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
    itemInvoices(kind: ItemKind, id: string, actor: Actor): Promise<{
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
    brand(actor: Actor): Promise<{
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
    activity(projectId: number, actor: Actor): Promise<FinanceActivityEntity[]>;
}
export declare function parseAmount(s: string | null | undefined): number;
export declare function billToFromLead(lead: LeadEntity): {
    name: string;
    email: string;
    address: string;
};
export {};
