import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { WorkflowEntity } from '../database/entities';
export declare class WorkflowsService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly log;
    constructor(repo: Repository<WorkflowEntity>);
    onApplicationBootstrap(): Promise<void>;
    findAll(): Promise<WorkflowEntity[]>;
    create(dto: any): Promise<WorkflowEntity>;
    update(id: string, dto: any): Promise<WorkflowEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
