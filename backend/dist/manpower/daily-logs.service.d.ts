import { Repository } from 'typeorm';
import { DailyLogEntity, LaborLogEntryEntity } from '../database/entities';
export interface ManpowerActor {
    name: string;
    id?: string;
}
export declare class DailyLogsService {
    private readonly logs;
    private readonly entries;
    constructor(logs: Repository<DailyLogEntity>, entries: Repository<LaborLogEntryEntity>);
    findEntries(opts: {
        projectId?: number;
        employeeId?: string;
        from?: string;
        to?: string;
    }): Promise<{
        dailyLog: DailyLogEntity | undefined;
        id: string;
        dailyLogId: string;
        employeeId: string;
        csiCodeId: string;
        hours: number;
        taskDetail: string;
        taskStatus: string;
        team: string;
    }[]>;
    findAllLogs(opts: {
        status?: string;
        projectId?: number;
    }): Promise<DailyLogEntity[]>;
    getForDay(projectId: number, date: string): Promise<{
        log: DailyLogEntity | {
            id: null;
            projectId: number;
            date: string;
            status: string;
            notes: string;
        };
        entries: LaborLogEntryEntity[];
    }>;
    save(dto: {
        projectId: number;
        date: string;
        notes?: string;
        entries?: any[];
    }, actor: ManpowerActor): Promise<{
        log: DailyLogEntity;
        entries: LaborLogEntryEntity[];
    }>;
    submit(id: string, actor: ManpowerActor): Promise<DailyLogEntity>;
    approve(id: string, actor: ManpowerActor): Promise<DailyLogEntity>;
    reject(id: string, note: string | undefined, actor: ManpowerActor): Promise<DailyLogEntity>;
    private require;
}
