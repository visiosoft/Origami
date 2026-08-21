import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TaskEntity, UserEntity } from '../database/entities';
import { type TaskAttachment } from '../database/task.types';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
export declare class TasksService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly users;
    private readonly attachments;
    private readonly log;
    constructor(repo: Repository<TaskEntity>, users: Repository<UserEntity>, attachments: AttachmentsService);
    onApplicationBootstrap(): Promise<void>;
    private hydrate;
    findAll(tab?: string, project?: string): Promise<TaskEntity[]>;
    findOne(id: string): Promise<TaskEntity>;
    private load;
    private daysOpen;
    create(dto: any, actor: UploadActor): Promise<TaskEntity>;
    update(id: string, dto: any, actor: UploadActor): Promise<TaskEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    addAttachments(id: string, files: any[], actor: UploadActor): Promise<TaskEntity>;
    addLink(id: string, name: string, url: string, actor: UploadActor): Promise<TaskEntity>;
    removeAttachment(id: string, attId: string, actor: UploadActor): Promise<TaskEntity>;
    attachment(id: string, attId: string): Promise<TaskAttachment>;
    addComment(id: string, text: string, actor: UploadActor): Promise<TaskEntity>;
}
