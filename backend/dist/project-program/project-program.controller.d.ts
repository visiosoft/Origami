import type { Response } from 'express';
import { ProjectProgramService } from './project-program.service';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import { type DocStep } from '../documents/program-document';
interface DocumentInput {
    projectId: number;
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
    get(projectId: string): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
    }>;
    save(body: {
        projectId: number;
        data: unknown;
    }, req: any): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
    }>;
    complete(body: {
        projectId: number;
        complete?: boolean;
    }): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
        sentAt: string;
        sentTo: string;
    }>;
    pdf(body: DocumentInput, res: Response): Promise<Response<any, Record<string, any>>>;
    send(body: DocumentInput & {
        to: string;
        cc?: string;
        subject: string;
        html: string;
    }, req: any): Promise<{
        ok: boolean;
        filename: string;
        to: string;
    }>;
    private render;
}
export {};
