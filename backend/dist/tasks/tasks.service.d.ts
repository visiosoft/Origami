import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SettingsService } from '../settings/settings.service';
import { type LogStatus } from './log-statuses';
export declare const LOG_ARCHIVE_DAYS = 7;
import { ChangeOrderEntity, TaskEntity, UserEntity, ChecklistTemplateEntity, DealEntity, LeadEntity, ProjectEntity } from '../database/entities';
import { type TaskAttachment } from '../database/task.types';
import { NotificationsService } from '../notifications/notifications.service';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
export declare class TasksService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly users;
    private readonly attachments;
    private readonly notifications;
    private readonly settings?;
    private readonly cos?;
    private readonly checklistTemplates?;
    private readonly leads?;
    private readonly deals?;
    private readonly projects?;
    private readonly log;
    constructor(repo: Repository<TaskEntity>, users: Repository<UserEntity>, attachments: AttachmentsService, notifications: NotificationsService, settings?: SettingsService | undefined, cos?: Repository<ChangeOrderEntity> | undefined, checklistTemplates?: Repository<ChecklistTemplateEntity> | undefined, leads?: Repository<LeadEntity> | undefined, deals?: Repository<DealEntity> | undefined, projects?: Repository<ProjectEntity> | undefined);
    statuses(): Promise<LogStatus[]>;
    saveStatuses(list: unknown): Promise<LogStatus[]>;
    onApplicationBootstrap(): Promise<void>;
    linkLeads(): Promise<number>;
    linkTargets(): Promise<{
        projects: {
            id: any;
            name: any;
            stage: any;
        }[];
        leads: {
            id: string;
            name: string;
            stage: string;
        }[];
    }>;
    adoptLead(leadId: string, projectName: string): Promise<number>;
    private leadFields;
    numberUnnumbered(): Promise<number>;
    moveToBuckets(): Promise<number>;
    private isAdmin;
    private raisedBy;
    private bucketRules;
    private archiveConfirmed;
    private hydrate;
    findAll(tab?: string, project?: string): Promise<TaskEntity[]>;
    findOne(id: string): Promise<TaskEntity>;
    private load;
    private daysOpen;
    create(dto: any, actor: UploadActor): Promise<TaskEntity>;
    private notice;
    update(id: string, dto: any, actor: UploadActor): Promise<TaskEntity>;
    private sendNotices;
    flushNotices(id: string): Promise<{
        sent: number;
    }>;
    flushOverdue(): Promise<void>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    addAttachments(id: string, files: any[], actor: UploadActor): Promise<TaskEntity>;
    addLink(id: string, name: string, url: string, actor: UploadActor): Promise<TaskEntity>;
    removeAttachment(id: string, attId: string, actor: UploadActor): Promise<TaskEntity>;
    attachment(id: string, attId: string): Promise<TaskAttachment>;
    link(id: string, kind: 'task' | 'changeOrder', targetId: string, actor: UploadActor): Promise<TaskEntity>;
    unlink(id: string, kind: 'task' | 'changeOrder', targetId: string, actor: UploadActor): Promise<TaskEntity>;
    createLinkedTask(id: string, dto: {
        subject?: string;
        description?: string;
        assignedTo?: string;
        assignedToId?: string;
        dueDate?: string;
    }, actor: UploadActor): Promise<{
        task: TaskEntity;
        entry: TaskEntity;
    }>;
    addComment(id: string, text: string, actor: UploadActor): Promise<TaskEntity>;
}
export declare function cleanIds(v: unknown): string[];
export declare function taskTitle(t: Pick<TaskEntity, 'id' | 'subject' | 'description'>): string;
