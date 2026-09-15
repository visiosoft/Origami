import { Repository } from 'typeorm';
import { ProjectProgramEntity, ProjectEntity, LeadProgramEntity, LeadEntity } from '../database/entities';
export interface ProgramActor {
    id?: string;
    name?: string;
}
export declare class ProjectProgramService {
    private readonly repo;
    private readonly projects;
    private readonly leadRepo;
    private readonly leads;
    private readonly log;
    constructor(repo: Repository<ProjectProgramEntity>, projects: Repository<ProjectEntity>, leadRepo: Repository<LeadProgramEntity>, leads: Repository<LeadEntity>);
    private parse;
    get(projectId: number): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
    }>;
    save(projectId: number, data: unknown, actor?: ProgramActor): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
    }>;
    markSent(projectId: number, to: string, actor?: ProgramActor): Promise<void>;
    setComplete(projectId: number, complete: boolean): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
    }>;
    getLead(leadId: string): Promise<{
        leadId: string;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
    }>;
    saveLead(leadId: string, data: unknown, actor?: ProgramActor): Promise<{
        leadId: string;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
    }>;
    markSentLead(leadId: string, to: string, actor?: ProgramActor): Promise<void>;
    setCompleteLead(leadId: string, complete: boolean): Promise<{
        leadId: string;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
    }>;
}
