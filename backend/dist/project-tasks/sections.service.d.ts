import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProjectSectionEntity } from '../database/entities';
import { ProjectSection } from '../seed-data/project-tasks';
export declare class SectionsService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly log;
    constructor(repo: Repository<ProjectSectionEntity>);
    onApplicationBootstrap(): Promise<void>;
    getById(id: string): Promise<ProjectSection | undefined>;
    forProject(projectId: number): Promise<ProjectSection[]>;
    create(dto: any): Promise<ProjectSectionEntity>;
    update(id: string, dto: any): Promise<ProjectSectionEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
