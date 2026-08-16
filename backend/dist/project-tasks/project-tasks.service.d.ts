import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProjectTaskEntity } from '../database/entities';
import { SectionsService } from './sections.service';
export declare class ProjectTasksService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly sections;
    private readonly log;
    constructor(repo: Repository<ProjectTaskEntity>, sections: SectionsService);
    onApplicationBootstrap(): Promise<void>;
    findAll(projectId?: number): Promise<any[]>;
    board(projectId: number): Promise<{
        sections: import("../seed-data/project-tasks").ProjectSection[];
        tasks: any[];
    }>;
    create(dto: any): Promise<ProjectTaskEntity>;
    update(id: string, dto: any): Promise<ProjectTaskEntity>;
    reparentTasks(fromSectionId: string, toSectionId: string): Promise<void>;
    deleteTasksInSection(sectionId: string): Promise<void>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
