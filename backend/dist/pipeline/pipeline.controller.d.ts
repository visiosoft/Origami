import { PipelineService, type FollowUpInput } from './pipeline.service';
import { AuthService } from '../auth/auth.service';
import { CreateDealDto } from './dto/create-deal.dto';
export declare class PipelineController {
    private readonly pipelineService;
    private readonly auth;
    constructor(pipelineService: PipelineService, auth: AuthService);
    findAll(archived?: string): Promise<(import("../database/entities").DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    })[]>;
    getStages(): import("../seed-data/pipeline").Stage[];
    findOne(id: string): Promise<import("../database/entities").DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    create(dto: CreateDealDto): Promise<import("../database/entities").DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    updateStage(id: string, stage: string, auth?: string): Promise<import("../database/entities").DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    setArchived(id: string, archived: boolean, auth?: string): Promise<import("../database/entities").DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    setRoles(id: string, roles: Record<string, string>, auth?: string): Promise<import("../database/entities").DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    setRejection(id: string, rejection: {
        rejectionType: 'internal' | 'client' | 'referred';
        rejectionReason?: string;
        referredToName?: string;
        referredToCompany?: string;
        referredToContact?: string;
    }, auth?: string): Promise<import("../database/entities").DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    addEvent(id: string, action: string, auth?: string): Promise<import("../database/entities").DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    convert(id: string, body: {
        stage?: string;
        name?: string;
        contractAmt?: string;
    }, auth?: string): Promise<{
        project: import("../database/entities").ProjectEntity;
        deal: import("../database/entities").DealEntity & {
            name: string;
            client: string;
            phone: string;
            email: string;
            location: string;
        };
    }>;
    logFollowUp(id: string, body: FollowUpInput, auth?: string): Promise<import("../database/entities").DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    setNotes(id: string, body: {
        notes: unknown[];
        action: string;
        stageName?: string;
        text?: string;
    }, auth?: string): Promise<import("../database/entities").DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
