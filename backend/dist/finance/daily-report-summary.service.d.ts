import { Repository } from 'typeorm';
import { ChangeOrderEntity, ProjectEntity, ProjectTaskEntity, RfiEntity } from '../database/entities';
import { FinancialsService } from './financials.service';
export declare const ROLLUP_STATUSES: readonly ["To Do", "Assigned", "In Progress", "On Hold", "Complete", "Confirmed"];
export type Rollup = Record<(typeof ROLLUP_STATUSES)[number], number>;
export declare function taskColumn(t: Pick<ProjectTaskEntity, 'status' | 'completed' | 'assigneeId' | 'assignee'>): keyof Rollup;
export declare function rfiColumn(status: string): keyof Rollup | null;
export declare class DailyReportSummaryService {
    private readonly fin;
    private readonly projects;
    private readonly tasks;
    private readonly rfis;
    private readonly cos;
    constructor(fin: FinancialsService, projects: Repository<ProjectEntity>, tasks: Repository<ProjectTaskEntity>, rfis: Repository<RfiEntity>, cos: Repository<ChangeOrderEntity>);
    summary(projectId: number, onDate?: string): Promise<{
        projectId: number;
        asOf: string;
        percentInvoiced: number | null;
        percentDuration: number | null;
        scheduleStart: string | null;
        scheduleEnd: string | null;
        changeOrderDays: number;
        tasks: Rollup;
        rfis: Rollup;
        changeOrders: Record<string, number>;
    }>;
}
