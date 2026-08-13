import { Repository } from 'typeorm';
import { TaskEntity } from '../database/entities';
export declare class TasksService {
    private readonly repo?;
    private mem;
    constructor(repo?: Repository<TaskEntity> | undefined);
    findAll(tab?: string, project?: string): any[] | Promise<TaskEntity[]>;
    findOne(id: string): Promise<any>;
    create(dto: any): any;
}
