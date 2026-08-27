import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProjectTaskEntity, UserEntity } from '../database/entities';
import { SectionsService } from './sections.service';
import { type TaskAttachment } from '../database/task.types';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare class ProjectTasksService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly users;
    private readonly sections;
    private readonly attachments;
    private readonly notifications;
    private readonly log;
    constructor(repo: Repository<ProjectTaskEntity>, users: Repository<UserEntity>, sections: SectionsService, attachments: AttachmentsService, notifications: NotificationsService);
    onApplicationBootstrap(): Promise<void>;
    private renameLegacyTitles;
    private hydrate;
    findAll(projectId?: number): Promise<any[]>;
    board(projectId: number): Promise<{
        sections: import("../seed-data/project-tasks").ProjectSection[];
        tasks: any[];
    }>;
    private load;
    private syncStatus;
    create(dto: any, actor?: UploadActor): Promise<ProjectTaskEntity>;
    update(id: string, dto: any, actor?: UploadActor): Promise<ProjectTaskEntity>;
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
