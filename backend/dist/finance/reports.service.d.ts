import { Repository } from 'typeorm';
import { CostEntryEntity, ProjectEntity, ProjectFinancialEntity, ProjectInvoiceEntity, ProjectPaymentEntity, RetentionReleaseEntity } from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { FinancialsService } from './financials.service';
import { ChangeOrdersService } from './change-orders.service';
import { CostsService } from './costs.service';
export declare class ReportsService {
    private readonly fin;
    private readonly costs;
    private readonly cos;
    private readonly projects;
    private readonly pfin;
    private readonly invoices;
    private readonly payments;
    private readonly releases;
    private readonly entries;
    constructor(fin: FinancialsService, costs: CostsService, cos: ChangeOrdersService, projects: Repository<ProjectEntity>, pfin: Repository<ProjectFinancialEntity>, invoices: Repository<ProjectInvoiceEntity>, payments: Repository<ProjectPaymentEntity>, releases: Repository<RetentionReleaseEntity>, entries: Repository<CostEntryEntity>);
    private projectsIn;
    wip(actor: Actor): Promise<{
        asOf: string;
        rows: any[];
        withoutCosts: string[];
    }>;
    arAging(actor: Actor, asOfIn?: string): Promise<{
        asOf: string;
        buckets: readonly ["current", "d1_30", "d31_60", "d61_90", "d90_plus"];
        totals: {
            [k: string]: any;
        };
        projects: {
            [k: string]: any;
        }[];
        invoices: {
            total: number;
            outstanding: number;
            totalC: undefined;
            outstandingC: undefined;
            invoiceId: string;
            number: string;
            projectId: number;
            projectName: string;
            billTo: string;
            invoiceDate: string;
            dueDate: string;
            bucket: "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";
            daysPastDue: number;
        }[];
    }>;
    budgetVsActual(actor: Actor, projectId?: number): Promise<any>;
    changeOrderRegister(actor: Actor): Promise<{
        id: any;
        projectId: any;
        projectName: any;
        number: any;
        title: any;
        reason: any;
        status: any;
        amount: any;
        cost: any;
        margin: any;
        scheduleImpactDays: any;
        dateRequested: any;
        submittedAt: any;
        approvedDate: any;
        signer: any;
        daysToApprove: number | null;
    }[]>;
    retention(actor: Actor): Promise<{
        rows: any[];
    }>;
    contractVsInvoiced(actor: Actor): Promise<{
        rows: any[];
    }>;
    cashForecast(actor: Actor, months?: number): Promise<{
        showCosts: boolean;
        months: any[];
    }>;
}
