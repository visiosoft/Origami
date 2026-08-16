import { PipelineService } from './pipeline.service';
import { CreateDealDto } from './dto/create-deal.dto';
export declare class PipelineController {
    private readonly pipelineService;
    constructor(pipelineService: PipelineService);
    findAll(): Promise<import("../database/entities").DealEntity[]>;
    getStages(): import("../seed-data/pipeline").Stage[];
    findOne(id: string): Promise<import("../database/entities").DealEntity>;
    create(dto: CreateDealDto): Promise<import("../database/entities").DealEntity>;
    updateStage(id: string, stage: string): Promise<import("../database/entities").DealEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
