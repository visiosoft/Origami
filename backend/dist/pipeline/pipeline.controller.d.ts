import { PipelineService, type FollowUpInput } from './pipeline.service';
import { AuthService } from '../auth/auth.service';
import { CreateDealDto } from './dto/create-deal.dto';
export declare class PipelineController {
    private readonly pipelineService;
    private readonly auth;
    constructor(pipelineService: PipelineService, auth: AuthService);
    findAll(archived?: string): Promise<import("../database/entities").DealEntity[]>;
    getStages(): import("../seed-data/pipeline").Stage[];
    findOne(id: string): Promise<import("../database/entities").DealEntity>;
    create(dto: CreateDealDto): Promise<import("../database/entities").DealEntity>;
    updateStage(id: string, stage: string, auth?: string): Promise<import("../database/entities").DealEntity>;
    setArchived(id: string, archived: boolean, auth?: string): Promise<import("../database/entities").DealEntity>;
    setRoles(id: string, roles: Record<string, string>, auth?: string): Promise<import("../database/entities").DealEntity>;
    addEvent(id: string, action: string, auth?: string): Promise<import("../database/entities").DealEntity>;
    convert(id: string, body: {
        stage?: string;
        name?: string;
        contractAmt?: string;
    }, auth?: string): Promise<{
        project: import("../database/entities").ProjectEntity;
        deal: import("../database/entities").DealEntity;
    }>;
    logFollowUp(id: string, body: FollowUpInput, auth?: string): Promise<import("../database/entities").DealEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
