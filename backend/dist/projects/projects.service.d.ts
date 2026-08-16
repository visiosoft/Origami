import { Repository } from 'typeorm';
import { ProjectEntity } from '../database/entities';
export declare class ProjectsService {
    private readonly repo;
    constructor(repo: Repository<ProjectEntity>);
    findAll(): Promise<ProjectEntity[]>;
    findOne(id: string): Promise<ProjectEntity>;
    create(dto: any): Promise<ProjectEntity>;
    update(id: string, dto: any): Promise<ProjectEntity>;
    remove(id: string): Promise<{
        id: number;
        deleted: boolean;
    }>;
}
