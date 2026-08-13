import { Repository } from 'typeorm';
import { DealEntity } from '../database/entities';
export declare class PipelineService {
    private readonly repo?;
    private mem;
    constructor(repo?: Repository<DealEntity> | undefined);
    getStages(): import("../seed-data/pipeline").Stage[];
    findAll(): any[] | Promise<DealEntity[]>;
    findOne(id: string): Promise<any>;
    create(dto: any): any;
    updateStage(id: string, stage: string): Promise<any>;
}
