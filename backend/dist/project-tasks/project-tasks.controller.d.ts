import type { Response } from 'express';
import { ProjectTasksService } from './project-tasks.service';
import { CreateProjectTaskDto, ReorderDto } from './dto/create-project-task.dto';
import { AddCommentDto, AddLinkDto } from '../tasks/dto/update-task.dto';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService } from '../google/attachments.service';
export declare class ProjectTasksController {
    private readonly service;
    private readonly auth;
    private readonly attachments;
    constructor(service: ProjectTasksService, auth: AuthService, attachments: AttachmentsService);
    findAll(projectId?: string): Promise<any[]>;
    board(projectId: string): Promise<{
        sections: import("../seed-data/project-tasks").ProjectSection[];
        tasks: any[];
    }> | {
        sections: never[];
        tasks: never[];
    };
    reorder(dto: ReorderDto): Promise<{
        sectionId: string;
        ordered: number;
    }>;
    create(dto: CreateProjectTaskDto, auth?: string): Promise<import("../database/entities").ProjectTaskEntity>;
    update(id: string, dto: Partial<CreateProjectTaskDto>, auth?: string): Promise<import("../database/entities").ProjectTaskEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    upload(id: string, files: any[], auth?: string): Promise<import("../database/entities").ProjectTaskEntity>;
    link(id: string, dto: AddLinkDto, auth?: string): Promise<import("../database/entities").ProjectTaskEntity>;
    removeAttachment(id: string, attId: string, auth?: string): Promise<import("../database/entities").ProjectTaskEntity>;
    content(id: string, attId: string, thumb: string, res: Response): Promise<void>;
    comment(id: string, dto: AddCommentDto, auth?: string): Promise<import("../database/entities").ProjectTaskEntity>;
}
