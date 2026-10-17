import type { Response } from 'express';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto, AddCommentDto, AddLinkDto, LinkDto, LinkedTaskDto } from './dto/update-task.dto';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService } from '../google/attachments.service';
export declare class TasksController {
    private readonly tasksService;
    private readonly auth;
    private readonly attachments;
    constructor(tasksService: TasksService, auth: AuthService, attachments: AttachmentsService);
    findAll(tab?: string, project?: string, auth?: string): Promise<import("../database/entities").TaskEntity[]>;
    statuses(): Promise<import("./log-statuses").LogStatus[]>;
    saveStatuses(body: {
        statuses?: unknown;
    }): Promise<import("./log-statuses").LogStatus[]>;
    linkTargets(auth?: string): Promise<{
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
    findOne(id: string, auth?: string): Promise<import("../database/entities").TaskEntity>;
    create(dto: CreateTaskDto, auth?: string): Promise<import("../database/entities").TaskEntity>;
    update(id: string, dto: UpdateTaskDto, auth?: string): Promise<import("../database/entities").TaskEntity>;
    notify(id: string): Promise<{
        sent: number;
    }>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    addRecordLink(id: string, dto: LinkDto, auth?: string): Promise<import("../database/entities").TaskEntity>;
    removeRecordLink(id: string, kind: string, targetId: string, auth?: string): Promise<import("../database/entities").TaskEntity>;
    linkedTask(id: string, dto: LinkedTaskDto, auth?: string): Promise<{
        task: import("../database/entities").TaskEntity;
        entry: import("../database/entities").TaskEntity;
    }>;
    upload(id: string, files: any[], auth?: string): Promise<import("../database/entities").TaskEntity>;
    link(id: string, dto: AddLinkDto, auth?: string): Promise<import("../database/entities").TaskEntity>;
    removeAttachment(id: string, attId: string, auth?: string): Promise<import("../database/entities").TaskEntity>;
    content(id: string, attId: string, thumb: string, res: Response): Promise<void>;
    comment(id: string, dto: AddCommentDto, auth?: string): Promise<import("../database/entities").TaskEntity>;
}
