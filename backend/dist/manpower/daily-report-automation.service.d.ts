import { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DailyLogEntity, ProjectEntity, UserEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService } from '../google/google.service';
import { ProjectHoldService } from '../project-tasks/project-hold.service';
export declare const UNKNOWN_STOP_FOLLOW_UP_DAYS = 14;
export declare const STOP_NOTICE_DAYS: number[];
export declare function noWorkRange(log: Pick<DailyLogEntity, 'sections' | 'date'>): {
    reason: 'stop' | 'holiday';
    from: string;
    to: string | null;
} | null;
export declare class DailyReportAutomationService implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logs;
    private readonly projects;
    private readonly users;
    private readonly settings;
    private readonly hold;
    private readonly google?;
    private readonly log;
    private timer;
    constructor(logs: Repository<DailyLogEntity>, projects: Repository<ProjectEntity>, users: Repository<UserEntity>, settings: SettingsService, hold: ProjectHoldService, google?: GoogleService | undefined);
    onApplicationBootstrap(): void;
    onApplicationShutdown(): void;
    private today;
    tick(): Promise<void>;
    afterSubmit(logId: string, actor: {
        id?: string;
        name: string;
    }): Promise<{
        held: boolean;
        created: number;
    }>;
    runDaily(today: string): Promise<{
        created: number;
        notices: number;
    }>;
    fillDays(source: DailyLogEntity, today: string): Promise<number>;
    stopNotices(source: DailyLogEntity, today: string): Promise<number>;
}
