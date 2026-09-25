import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DealEntity, LeadEntity } from '../database/entities';
import { ProjectsService } from '../projects/projects.service';
export declare const MAX_FOLLOW_UPS = 3;
export interface FollowUpInput {
    direction?: 'out' | 'in';
    method: string;
    outcome: string;
    note?: string;
    target?: string;
    contactName?: string;
    assignToId?: string;
    assignToName?: string;
}
export interface DealActor {
    name: string;
    id?: string;
}
export declare class PipelineService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly leads;
    private readonly projects;
    private readonly log;
    constructor(repo: Repository<DealEntity>, leads: Repository<LeadEntity>, projects: ProjectsService);
    onApplicationBootstrap(): Promise<void>;
    private rehomeRetiredStages;
    setContractValue(dealId: string, amount: string): Promise<string | null>;
    getStages(): import("../seed-data/pipeline").Stage[];
    private overlayLead;
    findAll(includeArchived?: boolean): Promise<(DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    })[]>;
    findOne(id: string): Promise<DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    create(dto: any): Promise<DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    updateStage(id: string, stage: string, actor?: DealActor): Promise<DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    setArchived(id: string, archived: boolean, actor?: DealActor): Promise<DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    setRoles(id: string, roles: Record<string, string>, actor?: DealActor): Promise<DealEntity & {
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
    }, actor?: DealActor): Promise<DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    logFollowUp(id: string, input: FollowUpInput, actor?: DealActor): Promise<DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    setNotes(id: string, notes: unknown[], change: {
        action: string;
        stageName?: string;
        text?: string;
    }, actor?: DealActor): Promise<DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    addEvent(id: string, action: string, actor?: DealActor, type?: 'auto' | 'pc' | 'pm'): Promise<DealEntity & {
        name: string;
        client: string;
        phone: string;
        email: string;
        location: string;
    }>;
    private event;
    convertToProject(id: string, opts: {
        stage?: string;
        name?: string;
        contractAmt?: string;
    }, actor?: DealActor): Promise<{
        project: import("../database/entities").ProjectEntity;
        deal: DealEntity & {
            name: string;
            client: string;
            phone: string;
            email: string;
            location: string;
        };
    }>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
