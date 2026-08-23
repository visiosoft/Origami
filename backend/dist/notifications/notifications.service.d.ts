import { Repository } from 'typeorm';
import { ProjectEntity, UserEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService } from '../google/google.service';
export type TaskSurface = 'board' | 'log';
export interface AssignmentNotice {
    surface: TaskSurface;
    taskId: string;
    title: string;
    description?: string;
    projectId?: number | string;
    projectName?: string;
    dueDate?: string;
    priority?: string;
    status?: string;
    assigneeId?: string | null;
    actor?: {
        name: string;
        id?: string;
    };
}
export declare class NotificationsService {
    private readonly users;
    private readonly projects;
    private readonly settings;
    private readonly google;
    private readonly log;
    constructor(users: Repository<UserEntity>, projects: Repository<ProjectEntity>, settings: SettingsService, google: GoogleService);
    taskAssigned(notice: AssignmentNotice): void;
    sendAssignment(notice: AssignmentNotice): Promise<{
        sent: boolean;
        reason?: string;
    }>;
    taskUrl(base: string, notice: Pick<AssignmentNotice, 'surface' | 'taskId' | 'projectId'>): string;
    private projectLabel;
}
