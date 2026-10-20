import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { NotifyHub } from '../notifications/notify-hub.service';
import { ProjectEntity } from '../database/entities';
export declare class ProjectsService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly hub?;
    private readonly log;
    constructor(repo: Repository<ProjectEntity>, hub?: NotifyHub | undefined);
    onApplicationBootstrap(): Promise<void>;
    findAll(): Promise<ProjectEntity[]>;
    findOne(id: string): Promise<ProjectEntity>;
    create(dto: any): Promise<ProjectEntity>;
    findByLeadId(leadId: string): Promise<ProjectEntity | null>;
    ensureForLead(deal: {
        id: string;
        name: string;
        value?: string;
        source?: string;
        assignee?: string;
        location?: string;
    }): Promise<ProjectEntity>;
    update(id: string, dto: any, actor?: {
        id?: string;
        name?: string;
    }): Promise<ProjectEntity>;
    private statusNotices;
    remove(id: string): Promise<{
        id: number;
        deleted: boolean;
    }>;
}
