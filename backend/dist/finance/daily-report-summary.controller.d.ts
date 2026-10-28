import { DailyReportSummaryService } from './daily-report-summary.service';
export declare class DailyReportSummaryController {
    private readonly service;
    constructor(service: DailyReportSummaryService);
    summary(projectId: string, date?: string): Promise<{
        projectId: number;
        asOf: string;
        percentInvoiced: number | null;
        percentDuration: number | null;
        scheduleStart: string | null;
        scheduleEnd: string | null;
        changeOrderDays: number;
        tasks: import("./daily-report-summary.service").Rollup;
        rfis: import("./daily-report-summary.service").Rollup;
        changeOrders: Record<string, number>;
    }>;
}
