import { Repository } from 'typeorm';
import { TaskEntity } from '../database/entities';
export declare class TasksService {
    private readonly repo;
    constructor(repo: Repository<TaskEntity>);
    findAll(tab?: string, project?: string): Promise<TaskEntity[]>;
    findOne(id: string): Promise<TaskEntity>;
    create(dto: any): Promise<TaskEntity>;
}
