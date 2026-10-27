import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { NotifyHub } from '../notifications/notify-hub.service';
import { ChecklistTemplateEntity, LeadEntity, ProjectEntity, ProjectTaskEntity, TaskEntity, UserEntity } from '../database/entities';
import { SectionsService } from './sections.service';
import { type TaskAttachment } from '../database/task.types';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare const ARCHIVE_AFTER_DAYS = 7;
export declare class ProjectTasksService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly users;
    private readonly sections;
    private readonly attachments;
    private readonly notifications;
    private readonly checklistTemplates?;
    private readonly leads?;
    private readonly hub?;
    private readonly logTasks?;
    private readonly projects?;
    private readonly log;
    constructor(repo: Repository<ProjectTaskEntity>, users: Repository<UserEntity>, sections: SectionsService, attachments: AttachmentsService, notifications: NotificationsService, checklistTemplates?: Repository<ChecklistTemplateEntity> | undefined, leads?: Repository<LeadEntity> | undefined, hub?: NotifyHub | undefined, logTasks?: Repository<TaskEntity> | undefined, projects?: Repository<ProjectEntity> | undefined);
    adoptLead(leadId: string, projectId: number): Promise<number>;
    onApplicationBootstrap(): Promise<void>;
    private renameLegacyTitles;
    private hydrate;
    private archiveConfirmed;
    findAll(projectId?: number | null): Promise<any[]>;
    board(projectId: number | null): Promise<{
        sections: import("../seed-data/project-tasks").ProjectSection[];
        tasks: any[];
    }>;
    get(id: string): Promise<ProjectTaskEntity>;
    private load;
    private syncBucketSection;
    private syncStatus;
    private createdByIdOf;
    private isAdmin;
    private assertSubtaskFields;
    private assertSubtasksDone;
    create(dto: any, actor?: UploadActor): Promise<ProjectTaskEntity>;
    private notice;
    update(id: string, dto: any, actor?: UploadActor): Promise<ProjectTaskEntity>;
    private involved;
    fixCompleted(): Promise<number>;
    private sendNotices;
    flushNotices(id: string, withSubtasks?: boolean): Promise<{
        sent: number;
    }>;
    startDueTasks(): Promise<number>;
    flushOverdue(): Promise<void>;
    reorder(sectionId: string, ids: string[]): Promise<{
        sectionId: string;
        ordered: number;
    }>;
    reparentTasks(fromSectionId: string, toSectionId: string): Promise<void>;
    deleteTasksInSection(sectionId: string): Promise<void>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    private scopeFor;
    addAttachments(id: string, files: any[], actor: UploadActor): Promise<ProjectTaskEntity>;
    addLink(id: string, name: string, url: string, actor: UploadActor): Promise<ProjectTaskEntity>;
    removeAttachment(id: string, attId: string, actor: UploadActor): Promise<ProjectTaskEntity>;
    attachment(id: string, attId: string): Promise<TaskAttachment>;
    addComment(id: string, text: string, actor: UploadActor): Promise<ProjectTaskEntity>;
}
