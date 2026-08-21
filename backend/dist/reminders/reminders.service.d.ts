import { Repository } from 'typeorm';
import { ProjectTaskEntity, TaskEntity, UserEntity, ProjectEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService } from '../google/google.service';
export declare class RemindersService {
    private readonly projectTasks;
    private readonly tasks;
    private readonly users;
    private readonly projects;
    private readonly settings;
    private readonly google;
    private readonly log;
    constructor(projectTasks: Repository<ProjectTaskEntity>, tasks: Repository<TaskEntity>, users: Repository<UserEntity>, projects: Repository<ProjectEntity>, settings: SettingsService, google: GoogleService);
    tick(): Promise<void>;
    private localParts;
    run(): Promise<{
        sent: number;
        skipped: number;
        recipients: string[];
    }>;
    private isMine;
    private bucket;
}
