import { Repository } from 'typeorm';
import { ProjectProgramEntity, ProjectEntity, LeadProgramEntity, LeadEntity, ProjectProgramVersionEntity } from '../database/entities';
import { PeopleService } from '../people/people.service';
export interface ProgramActor {
    id?: string;
    name?: string;
}
export declare class ProjectProgramService {
    private readonly repo;
    private readonly projects;
    private readonly leadRepo;
    private readonly leads;
    private readonly versions;
    private readonly people;
    private readonly log;
    constructor(repo: Repository<ProjectProgramEntity>, projects: Repository<ProjectEntity>, leadRepo: Repository<LeadProgramEntity>, leads: Repository<LeadEntity>, versions: Repository<ProjectProgramVersionEntity>, people: PeopleService);
    private snapshot;
    listVersions(ownerKey: string): Promise<{
        id: number;
        savedAt: string;
        savedBy: string;
    }[]>;
    getVersion(ownerKey: string, id: number): Promise<{
        id: number;
        savedAt: string;
        savedBy: string;
        data: Record<string, any>;
    }>;
    private parse;
    get(projectId: number): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
        signedAt: string;
        signedByName: string;
        signedByEmail: string;
        signatureImage: string;
    }>;
    private assertClientAccess;
    getForClient(projectId: number, email: string): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
        signedAt: string;
        signedByName: string;
        signedByEmail: string;
        signatureImage: string;
    }>;
    sign(projectId: number, signer: {
        name: string;
        email: string;
    }, image: string, meta: {
        ip: string;
        userAgent: string;
    }): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
        signedAt: string;
        signedByName: string;
        signedByEmail: string;
        signatureImage: string;
    }>;
    save(projectId: number, data: unknown, actor?: ProgramActor): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
        signedAt: string;
        signedByName: string;
        signedByEmail: string;
        signatureImage: string;
    }>;
    listVersionsFor(projectId: number): Promise<{
        id: number;
        savedAt: string;
        savedBy: string;
    }[]>;
    getVersionFor(projectId: number, id: number): Promise<{
        id: number;
        savedAt: string;
        savedBy: string;
        data: Record<string, any>;
    }>;
    restoreVersion(projectId: number, id: number, actor?: ProgramActor): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
        signedAt: string;
        signedByName: string;
        signedByEmail: string;
        signatureImage: string;
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
        signedAt: string;
        signedByName: string;
        signedByEmail: string;
        signatureImage: string;
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
    listVersionsForLead(leadId: string): Promise<{
        id: number;
        savedAt: string;
        savedBy: string;
    }[]>;
    getVersionForLead(leadId: string, id: number): Promise<{
        id: number;
        savedAt: string;
        savedBy: string;
        data: Record<string, any>;
    }>;
    restoreVersionLead(leadId: string, id: number, actor?: ProgramActor): Promise<{
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
