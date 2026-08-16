import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { WorkflowItemEntity } from '../database/entities';
export declare class WorkflowItemsService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly log;
    constructor(repo: Repository<WorkflowItemEntity>);
    onApplicationBootstrap(): Promise<void>;
    findAll(workflowId?: string): Promise<WorkflowItemEntity[]>;
    create(dto: any): Promise<WorkflowItemEntity>;
    update(id: string, dto: any): Promise<WorkflowItemEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    deleteByWorkflow(workflowId: string): Promise<void>;
}
