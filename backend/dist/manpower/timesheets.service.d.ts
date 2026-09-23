import { Repository } from 'typeorm';
import { DailyLogEntity, LaborLogEntryEntity, ProjectEntity } from '../database/entities';
export declare class TimesheetsService {
    private readonly logs;
    private readonly entries;
    private readonly projects;
    constructor(logs: Repository<DailyLogEntity>, entries: Repository<LaborLogEntryEntity>, projects: Repository<ProjectEntity>);
    forEmployee(employeeId: string, from: string, to: string): Promise<{
        rows: {
            date: string;
            projectId: number;
            projectName: string;
            csiCodeId: string;
            hours: number;
            taskDetail: string;
            status: string;
        }[];
        totalHours: number;
    }>;
}
