import { PipelineService } from './pipeline.service';
import { CreateDealDto } from './dto/create-deal.dto';
export declare class PipelineController {
    private readonly pipelineService;
    constructor(pipelineService: PipelineService);
    findAll(): import("./pipeline.service").Deal[];
    getStages(): {
        id: string;
        name: string;
        color: string;
    }[];
    findOne(id: string): import("./pipeline.service").Deal;
    create(dto: CreateDealDto): import("./pipeline.service").Deal;
    updateStage(id: string, stage: string): import("./pipeline.service").Deal;
}
