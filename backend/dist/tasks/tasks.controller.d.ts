import type { Response } from 'express';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto, AddCommentDto, AddLinkDto } from './dto/update-task.dto';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService } from '../google/attachments.service';
export declare class TasksController {
    private readonly tasksService;
    private readonly auth;
    private readonly attachments;
    constructor(tasksService: TasksService, auth: AuthService, attachments: AttachmentsService);
    findAll(tab?: string, project?: string): Promise<import("../database/entities").TaskEntity[]>;
    findOne(id: string): Promise<import("../database/entities").TaskEntity>;
    create(dto: CreateTaskDto, auth?: string): Promise<import("../database/entities").TaskEntity>;
    update(id: string, dto: UpdateTaskDto, auth?: string): Promise<import("../database/entities").TaskEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    upload(id: string, files: any[], auth?: string): Promise<import("../database/entities").TaskEntity>;
    link(id: string, dto: AddLinkDto, auth?: string): Promise<import("../database/entities").TaskEntity>;
    removeAttachment(id: string, attId: string, auth?: string): Promise<import("../database/entities").TaskEntity>;
    content(id: string, attId: string, thumb: string, res: Response): Promise<void>;
    comment(id: string, dto: AddCommentDto, auth?: string): Promise<import("../database/entities").TaskEntity>;
}
