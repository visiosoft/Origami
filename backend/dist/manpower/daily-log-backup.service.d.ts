import { Repository } from 'typeorm';
import { CsiCodeEntity, DailyLogEntity, EmployeeEntity, LaborLogEntryEntity, ProjectEntity, UserEntity } from '../database/entities';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
export interface DailyLogRow {
    worker: string;
    workerId: string;
    trade: string;
    code: string;
    division: string;
    hours: number;
    status: string;
    team: string;
    detail: string;
}
export declare function dailyLogRows(entries: LaborLogEntryEntity[], employees: EmployeeEntity[], codes: CsiCodeEntity[]): DailyLogRow[];
export declare function dailyLogCsv(meta: {
    project: string;
    date: string;
    supervisor: string;
    status: string;
    notes?: string;
}, rows: DailyLogRow[]): string;
export declare class DailyLogBackupService {
    private readonly logs;
    private readonly entries;
    private readonly projects;
    private readonly employees;
    private readonly codes;
    private readonly users;
    private readonly google;
    private readonly settings;
    private readonly log;
    constructor(logs: Repository<DailyLogEntity>, entries: Repository<LaborLogEntryEntity>, projects: Repository<ProjectEntity>, employees: Repository<EmployeeEntity>, codes: Repository<CsiCodeEntity>, users: Repository<UserEntity>, google: GoogleService, settings: SettingsService);
    recipients(): Promise<string[]>;
    afterSubmit(logId: string): void;
    send(logId: string, to?: string[]): Promise<{
        sent: boolean;
        to: string[];
        attachments: string[];
    }>;
}
