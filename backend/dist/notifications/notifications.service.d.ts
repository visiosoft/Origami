import { Repository } from 'typeorm';
import { ProjectEntity, UserEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService } from '../google/google.service';
import { NotifyHub } from './notify-hub.service';
export type TaskFollow = {
    kind: 'added' | 'comment' | 'done' | 'mention' | 'status';
    comment?: string;
};
export type TaskSurface = 'board' | 'log';
export interface AssignmentNotice {
    surface: TaskSurface;
    taskId: string;
    title: string;
    description?: string;
    projectId?: number | string | null;
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
    private readonly hub?;
    private readonly log;
    constructor(users: Repository<UserEntity>, projects: Repository<ProjectEntity>, settings: SettingsService, google: GoogleService, hub?: NotifyHub | undefined);
    taskAssigned(notice: AssignmentNotice): void;
    taskFollowUp(notice: AssignmentNotice, recipientIds: string[], follow: TaskFollow): void;
    sendAssignment(notice: AssignmentNotice, follow?: TaskFollow, sample?: boolean): Promise<{
        sent: boolean;
        reason?: string;
    }>;
    private emailAssignment;
    taskUrl(base: string, notice: Pick<AssignmentNotice, 'surface' | 'taskId' | 'projectId'>): string;
    private projectLabel;
}
