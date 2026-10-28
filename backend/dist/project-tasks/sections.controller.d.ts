import type { SessionClaims } from '../auth/crypto.util';
import { SectionsService } from './sections.service';
import { ProjectTasksService } from './project-tasks.service';
import { CreateSectionDto } from './dto/create-section.dto';
export declare class SectionsController {
    private readonly service;
    private readonly tasks;
    constructor(service: SectionsService, tasks: ProjectTasksService);
    findAll(projectId: string): Promise<import("../seed-data/project-tasks").ProjectSection[]>;
    create(dto: CreateSectionDto, c?: SessionClaims | null): Promise<import("../database/entities").ProjectSectionEntity>;
    update(id: string, dto: Partial<CreateSectionDto>, c?: SessionClaims | null): Promise<import("../database/entities").ProjectSectionEntity>;
    remove(id: string, c?: SessionClaims | null): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
