import type { Response } from 'express';
import { ProjectTasksService } from './project-tasks.service';
import { CreateProjectTaskDto, ReorderDto } from './dto/create-project-task.dto';
import { AddCommentDto, AddLinkDto } from '../tasks/dto/update-task.dto';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService } from '../google/attachments.service';
import { ProjectAccessService } from '../auth/project-access.service';
import type { SessionClaims } from '../auth/crypto.util';
export declare class ProjectTasksController {
    private readonly service;
    private readonly auth;
    private readonly attachments;
    private readonly access;
    constructor(service: ProjectTasksService, auth: AuthService, attachments: AttachmentsService, access: ProjectAccessService);
    private mayTouch;
    private parseProjectId;
    findAll(projectId?: string, auth?: string): Promise<any[]>;
    board(projectId?: string, auth?: string): Promise<{
        sections: import("../seed-data/project-tasks").ProjectSection[];
        tasks: any[];
    }>;
    reorder(dto: ReorderDto): Promise<{
        sectionId: string;
        ordered: number;
    }>;
    create(dto: CreateProjectTaskDto, auth?: string): Promise<import("../database/entities").ProjectTaskEntity>;
    update(id: string, dto: Partial<CreateProjectTaskDto>, auth?: string, claims?: SessionClaims | null): Promise<import("../database/entities").ProjectTaskEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    upload(id: string, files: any[], auth?: string, claims?: SessionClaims | null): Promise<import("../database/entities").ProjectTaskEntity>;
    link(id: string, dto: AddLinkDto, auth?: string, claims?: SessionClaims | null): Promise<import("../database/entities").ProjectTaskEntity>;
    removeAttachment(id: string, attId: string, auth?: string, claims?: SessionClaims | null): Promise<import("../database/entities").ProjectTaskEntity>;
    content(id: string, attId: string, thumb: string, res: Response, claims: SessionClaims | null): Promise<void>;
    comment(id: string, dto: AddCommentDto, auth?: string, claims?: SessionClaims | null): Promise<import("../database/entities").ProjectTaskEntity>;
}
