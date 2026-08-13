import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
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
