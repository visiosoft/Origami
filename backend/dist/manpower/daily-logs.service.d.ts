import { Repository } from 'typeorm';
import { DailyLogEntity, DailyReportTemplateEntity, LaborLogEntryEntity, UserEntity } from '../database/entities';
export interface ManpowerActor {
    name: string;
    id?: string;
}
export declare class DailyLogsService {
    private readonly logs;
    private readonly entries;
    private readonly templates?;
    private readonly users?;
    constructor(logs: Repository<DailyLogEntity>, entries: Repository<LaborLogEntryEntity>, templates?: Repository<DailyReportTemplateEntity> | undefined, users?: Repository<UserEntity> | undefined);
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
    private versionsOf;
    private newLog;
    getForDay(projectId: number, date: string, id?: string): Promise<{
        log: DailyLogEntity;
        entries: LaborLogEntryEntity[];
        versions: {
            id: string;
            version: number;
            status: string;
            autoReason: string | null;
            supervisorName: string;
            createdAt: string;
        }[];
    }>;
    save(dto: {
        id?: string;
        projectId: number;
        date: string;
        notes?: string;
        entries?: any[];
        newVersion?: boolean;
        sections?: Record<string, any> | null;
        onBehalfOf?: string;
        certifiedName?: string;
        signatureDataUrl?: string;
        dupBaseline?: Record<string, any> | null;
        dupFromDate?: string;
    }, actor: ManpowerActor): Promise<{
        log: DailyLogEntity;
        entries: LaborLogEntryEntity[];
    }>;
    submit(id: string, actor: ManpowerActor): Promise<DailyLogEntity>;
    approve(id: string, actor: ManpowerActor): Promise<DailyLogEntity>;
    reject(id: string, note: string | undefined, actor: ManpowerActor): Promise<DailyLogEntity>;
    listTemplates(): Promise<DailyReportTemplateEntity[]>;
    saveTemplate(dto: {
        name: string;
        sections?: Record<string, any> | null;
        entries?: Record<string, any>[];
    }, actor: ManpowerActor): Promise<DailyReportTemplateEntity>;
    removeTemplate(id: string, actor: ManpowerActor): Promise<{
        id: string;
        deleted: boolean;
    }>;
    ownerEmail(log: DailyLogEntity): Promise<string | null>;
    private isAdmin;
    private require;
}
