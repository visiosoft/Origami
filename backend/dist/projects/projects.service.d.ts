import { Repository } from 'typeorm';
import { ProjectEntity } from '../database/entities';
export declare class ProjectsService {
    private readonly repo?;
    private mem;
    constructor(repo?: Repository<ProjectEntity> | undefined);
    findAll(): any[] | Promise<ProjectEntity[]>;
    findOne(id: string): Promise<any>;
    create(dto: any): any;
    update(id: string, dto: any): Promise<any>;
}
