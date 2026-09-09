import { Repository } from 'typeorm';
import { ProjectProgramEntity, ProjectEntity } from '../database/entities';
export interface ProgramActor {
    id?: string;
    name?: string;
}
export declare class ProjectProgramService {
    private readonly repo;
    private readonly projects;
    private readonly log;
    constructor(repo: Repository<ProjectProgramEntity>, projects: Repository<ProjectEntity>);
    private parse;
    get(projectId: number): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
    }>;
    save(projectId: number, data: unknown, actor?: ProgramActor): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
    }>;
    setComplete(projectId: number, complete: boolean): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
    }>;
}
