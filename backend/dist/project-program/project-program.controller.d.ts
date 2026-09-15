import type { Response } from 'express';
import { ProjectProgramService } from './project-program.service';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import { type DocStep } from '../documents/program-document';
import type { AuthedRequest } from '../auth/guards/session.guard';
interface DocumentInput {
    projectId?: number;
    leadId?: string;
    projectName?: string;
    subtitle?: string;
    date?: string;
    steps: DocStep[];
}
export declare class ProjectProgramController {
    private readonly service;
    private readonly google;
    private readonly settings;
    constructor(service: ProjectProgramService, google: GoogleService, settings: SettingsService);
    get(projectId?: string, leadId?: string): Promise<{
        leadId: string;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
    }> | Promise<{
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
    getMine(projectId: string, req: AuthedRequest): Promise<{
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
    sign(body: {
        projectId: number;
        name: string;
        image: string;
    }, req: AuthedRequest): Promise<{
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
    save(body: {
        projectId?: number;
        leadId?: string;
        data: unknown;
    }, req: AuthedRequest): Promise<{
        leadId: string;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
    }> | Promise<{
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
    complete(body: {
        projectId?: number;
        leadId?: string;
        complete?: boolean;
    }): Promise<{
        leadId: string;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
    }> | Promise<{
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
    listVersions(projectId?: string, leadId?: string): Promise<{
        id: number;
        savedAt: string;
        savedBy: string;
    }[]>;
    getVersion(id: string, projectId?: string, leadId?: string): Promise<{
        id: number;
        savedAt: string;
        savedBy: string;
        data: Record<string, any>;
    }>;
    restoreVersion(id: string, body: {
        projectId?: number;
        leadId?: string;
    }, req: AuthedRequest): Promise<{
        leadId: string;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
    }> | Promise<{
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
    pdf(body: DocumentInput, res: Response): Promise<Response<any, Record<string, any>>>;
    send(body: DocumentInput & {
        to: string;
        cc?: string;
        subject: string;
        html: string;
    }, req: AuthedRequest): Promise<{
        ok: boolean;
        filename: string;
        to: string;
    }>;
    private render;
}
export {};
