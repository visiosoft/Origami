import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DealEntity } from '../database/entities';
export interface DealActor {
    name: string;
    id?: string;
}
export declare class PipelineService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly log;
    constructor(repo: Repository<DealEntity>);
    onApplicationBootstrap(): Promise<void>;
    getStages(): import("../seed-data/pipeline").Stage[];
    findAll(includeArchived?: boolean): Promise<DealEntity[]>;
    findOne(id: string): Promise<DealEntity>;
    create(dto: any): Promise<DealEntity>;
    updateStage(id: string, stage: string, actor?: DealActor): Promise<DealEntity>;
    setArchived(id: string, archived: boolean, actor?: DealActor): Promise<DealEntity>;
    setRoles(id: string, roles: Record<string, string>, actor?: DealActor): Promise<DealEntity>;
    addEvent(id: string, action: string, actor?: DealActor, type?: 'auto' | 'pc' | 'pm'): Promise<DealEntity>;
    private event;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
