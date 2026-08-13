import { Repository } from 'typeorm';
import { FinanceEntity, InvoiceEntity, DealEntity, TaskEntity } from '../database/entities';
export declare class DashboardService {
    private readonly finance?;
    private readonly invoices?;
    private readonly deals?;
    private readonly tasks?;
    constructor(finance?: Repository<FinanceEntity> | undefined, invoices?: Repository<InvoiceEntity> | undefined, deals?: Repository<DealEntity> | undefined, tasks?: Repository<TaskEntity> | undefined);
    private finRows;
    private internalInvoices;
    private dealRows;
    private taskRows;
    getKpis(): Promise<{
        activeProjects: number;
        leadPipeline: {
            total: number;
            won: number;
            lost: number;
            live: number;
        };
        contractValue: any;
        outstandingInvoices: any;
    }>;
    getBudgetVsSpend(): Promise<{
        name: any;
        exec: any;
        contractType: any;
        phase: any;
        base: any;
        co: any;
        reimb: any;
        baseUsed: any;
        coUsed: any;
        reimbUsed: any;
        timePct: any;
    }[]>;
    getRevenueByMonth(): Promise<{
        month: string;
        collected: number;
        outstanding: number;
    }[]>;
    getLeadFunnel(): Promise<{
        stage: string;
        count: number;
        conversionPct: number;
    }[]>;
    getWorkload(): Promise<{
        name: string;
        tasks: number;
    }[]>;
}
