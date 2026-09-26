import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService } from '../google/attachments.service';
import { AddLinkDto } from '../tasks/dto/update-task.dto';
import { LeadFilesService } from './lead-files.service';
import { ClientWelcomeService } from './client-welcome.service';
import { AllFilesService } from './all-files.service';
export declare class LeadFilesController {
    private readonly files;
    private readonly auth;
    private readonly attachments;
    private readonly welcome;
    private readonly all;
    constructor(files: LeadFilesService, auth: AuthService, attachments: AttachmentsService, welcome: ClientWelcomeService, all: AllFilesService);
    allForProject(projectId: string): Promise<{
        leadId: string | null;
        projectId: number | null;
        projectName: string;
        files: {
            n: number;
            id: string;
            name: string;
            scope: "lead-files" | "tasks" | "project-tasks" | "rfis" | "file-room";
            kind: string;
            source: import("./all-files.service").FileSource;
            size?: number | undefined;
            mimeType?: string | undefined;
            uploadedBy?: string | undefined;
            where: string;
            ownerId: string;
            url?: string | undefined;
            uploadedAt?: string | undefined;
            taskNumber?: string | undefined;
        }[];
    }>;
    allForLead(leadId: string): Promise<{
        leadId: string | null;
        projectId: number | null;
        projectName: string;
        files: {
            n: number;
            id: string;
            name: string;
            scope: "lead-files" | "tasks" | "project-tasks" | "rfis" | "file-room";
            kind: string;
            source: import("./all-files.service").FileSource;
            size?: number | undefined;
            mimeType?: string | undefined;
            uploadedBy?: string | undefined;
            where: string;
            ownerId: string;
            url?: string | undefined;
            uploadedAt?: string | undefined;
            taskNumber?: string | undefined;
        }[];
    }>;
    welcomeStatus(leadId: string): Promise<{
        sentAt: string | null;
        sentTo: string | null;
        sentBy: string | null;
        linkLive: boolean;
        expiresAt: string | null;
        items: string[];
        uploads: number;
    }>;
    sendWelcome(leadId: string, dto: {
        to?: string;
        note?: string;
        items?: string[];
    }, a?: string): Promise<{
        url: string;
        sentAt: string | null;
        sentTo: string | null;
        sentBy: string | null;
        linkLive: boolean;
        expiresAt: string | null;
        items: string[];
        uploads: number;
    }>;
    disableLink(leadId: string): Promise<{
        sentAt: string | null;
        sentTo: string | null;
        sentBy: string | null;
        linkLive: boolean;
        expiresAt: string | null;
        items: string[];
        uploads: number;
    }>;
    list(leadId: string): Promise<import("../database/entities").LeadAttachment[]>;
    upload(leadId: string, files: any[], stage?: string, stageName?: string, a?: string): Promise<import("../database/entities").LeadAttachment[]>;
    link(leadId: string, dto: AddLinkDto & {
        stage?: string;
        stageName?: string;
    }, a?: string): Promise<import("../database/entities").LeadAttachment[]>;
    remove(leadId: string, attId: string): Promise<import("../database/entities").LeadAttachment[]>;
    content(leadId: string, attId: string, thumb: string, res: Response): Promise<void>;
}
