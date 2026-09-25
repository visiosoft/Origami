import { AuthService } from '../auth/auth.service';
import { DailyLogsService } from './daily-logs.service';
import { DailyLogBackupService } from './daily-log-backup.service';
import { SaveDailyLogDto, RejectDailyLogDto } from './dto/daily-log.dto';
export declare class DailyLogsController {
    private readonly service;
    private readonly auth;
    private readonly backup;
    constructor(service: DailyLogsService, auth: AuthService, backup: DailyLogBackupService);
    findAll(status?: string, projectId?: string): Promise<import("../database/entities").DailyLogEntity[]>;
    getForDay(projectId: string, date: string): Promise<{
        log: import("../database/entities").DailyLogEntity | {
            id: null;
            projectId: number;
            date: string;
            status: string;
            notes: string;
        };
        entries: import("../database/entities").LaborLogEntryEntity[];
    }>;
    save(dto: SaveDailyLogDto, auth?: string): Promise<{
        log: import("../database/entities").DailyLogEntity;
        entries: import("../database/entities").LaborLogEntryEntity[];
    }>;
    submit(id: string, auth?: string): Promise<import("../database/entities").DailyLogEntity>;
    email(id: string, body: {
        to?: string;
    }): Promise<{
        sent: boolean;
        to: string[];
        attachments: string[];
    }>;
    approve(id: string, auth?: string): Promise<import("../database/entities").DailyLogEntity>;
    reject(id: string, dto: RejectDailyLogDto, auth?: string): Promise<import("../database/entities").DailyLogEntity>;
}
