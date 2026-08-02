export declare class DashboardService {
    getKpis(): {
        activeProjects: number;
        leadPipeline: {
            total: number;
            won: number;
            lost: number;
            live: number;
        };
        contractValue: number;
        outstandingInvoices: number;
    };
    getBudgetVsSpend(): {
        name: string;
        exec: string;
        contractType: string;
        phase: string;
        base: number;
        co: number;
        reimb: number;
        baseUsed: number;
        coUsed: number;
        reimbUsed: number;
        timePct: number;
    }[];
    getRevenueByMonth(): {
        month: string;
        collected: number;
        outstanding: number;
    }[];
    getLeadFunnel(): {
        stage: string;
        count: number;
        conversionPct: number;
    }[];
    getWorkload(): {
        name: string;
        tasks: number;
    }[];
}
