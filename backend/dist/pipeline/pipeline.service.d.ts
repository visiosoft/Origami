import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DealEntity, LeadEntity } from '../database/entities';
import { ProjectsService } from '../projects/projects.service';
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
    getStages(): import("../seed-data/pipeline").Stage[];
    findAll(includeArchived?: boolean): Promise<DealEntity[]>;
    findOne(id: string): Promise<DealEntity>;
    create(dto: any): Promise<DealEntity>;
    updateStage(id: string, stage: string, actor?: DealActor): Promise<DealEntity>;
    setArchived(id: string, archived: boolean, actor?: DealActor): Promise<DealEntity>;
    setRoles(id: string, roles: Record<string, string>, actor?: DealActor): Promise<DealEntity>;
    addEvent(id: string, action: string, actor?: DealActor, type?: 'auto' | 'pc' | 'pm'): Promise<DealEntity>;
    private event;
    convertToProject(id: string, opts: {
        stage?: string;
        name?: string;
        contractAmt?: string;
    }, actor?: DealActor): Promise<{
        project: import("../database/entities").ProjectEntity;
        deal: DealEntity;
    }>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
