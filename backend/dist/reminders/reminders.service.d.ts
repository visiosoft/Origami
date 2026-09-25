import { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProjectTaskEntity, TaskEntity, UserEntity, ProjectEntity, ProjectPhaseEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService } from '../google/google.service';
import { type ReminderBuckets, type ReminderTask } from './reminder.templates';
export declare const DEFAULT_REMINDER_TIMEZONE = "America/Los_Angeles";
export declare function addDays(date: string, n: number): string;
export declare function isoDue(raw: string | null | undefined, today: string): string;
export declare function bucketTasks(tasks: ReminderTask[], today: string): ReminderBuckets;
export declare function wantsDigest(user: Pick<UserEntity, 'notifyByEmail' | 'digestFrequency'>, today: string): boolean;
export declare class RemindersService implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly projectTasks;
    private readonly tasks;
    private readonly users;
    private readonly projects;
    private readonly phases;
    private readonly settings;
    private readonly google;
    private readonly log;
    private timer;
    constructor(projectTasks: Repository<ProjectTaskEntity>, tasks: Repository<TaskEntity>, users: Repository<UserEntity>, projects: Repository<ProjectEntity>, phases: Repository<ProjectPhaseEntity>, settings: SettingsService, google: GoogleService);
    onApplicationBootstrap(): void;
    onModuleDestroy(): void;
    tick(): Promise<void>;
    private timezone;
    private load;
    private tasksFor;
    sendMine(userId: string): Promise<{
        sent: boolean;
        reason?: string;
        overdue: number;
        today: number;
        soon: number;
    }>;
    private localParts;
    run(today?: string): Promise<{
        sent: number;
        skipped: number;
        recipients: string[];
    }>;
    private isMine;
    private runOverdueOnly;
    private runProgressChecks;
    private runOverstretch;
}
