import { CreateDealDto } from './dto/create-deal.dto';
export interface Deal {
    id: string;
    name: string;
    client: string;
    value: number;
    stage: string;
    owner?: string;
    ageDays: number;
    qualScores?: Record<string, number>;
}
export declare class PipelineService {
    private stages;
    private deals;
    getStages(): {
        id: string;
        name: string;
        color: string;
    }[];
    findAll(): Deal[];
    findOne(id: string): Deal;
    create(dto: CreateDealDto): Deal;
    updateStage(id: string, stage: string): Deal;
}
