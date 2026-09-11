import { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProjectTaskEntity, TaskEntity, UserEntity, ProjectEntity, ProjectPhaseEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService } from '../google/google.service';
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
    private localParts;
    run(): Promise<{
        sent: number;
        skipped: number;
        recipients: string[];
    }>;
    private isMine;
    private bucket;
    private runOverdueOnly;
    private runProgressChecks;
    private runOverstretch;
}
