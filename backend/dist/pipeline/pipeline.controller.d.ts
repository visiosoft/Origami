import { PipelineService } from './pipeline.service';
import { CreateDealDto } from './dto/create-deal.dto';
export declare class PipelineController {
    private readonly pipelineService;
    constructor(pipelineService: PipelineService);
    findAll(): any[] | Promise<import("../database/entities").DealEntity[]>;
    getStages(): import("../seed-data/pipeline").Stage[];
    findOne(id: string): Promise<any>;
    create(dto: CreateDealDto): any;
    updateStage(id: string, stage: string): Promise<any>;
}
