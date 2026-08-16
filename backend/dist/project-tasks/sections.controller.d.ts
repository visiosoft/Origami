import { SectionsService } from './sections.service';
import { ProjectTasksService } from './project-tasks.service';
import { CreateSectionDto } from './dto/create-section.dto';
export declare class SectionsController {
    private readonly service;
    private readonly tasks;
    constructor(service: SectionsService, tasks: ProjectTasksService);
    findAll(projectId: string): Promise<import("../seed-data/project-tasks").ProjectSection[]>;
    create(dto: CreateSectionDto): Promise<import("../database/entities").ProjectSectionEntity>;
    update(id: string, dto: Partial<CreateSectionDto>): Promise<import("../database/entities").ProjectSectionEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
