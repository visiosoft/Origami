import { Repository } from 'typeorm';
import { DealEntity } from '../database/entities';
export declare class PipelineService {
    private readonly repo;
    constructor(repo: Repository<DealEntity>);
    getStages(): import("../seed-data/pipeline").Stage[];
    findAll(): Promise<DealEntity[]>;
    findOne(id: string): Promise<DealEntity>;
    create(dto: any): Promise<DealEntity>;
    updateStage(id: string, stage: string): Promise<DealEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
