import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService } from '../google/attachments.service';
import { AddLinkDto } from '../tasks/dto/update-task.dto';
import { LeadFilesService } from './lead-files.service';
export declare class LeadFilesController {
    private readonly files;
    private readonly auth;
    private readonly attachments;
    constructor(files: LeadFilesService, auth: AuthService, attachments: AttachmentsService);
    list(leadId: string): Promise<import("../database/entities").LeadAttachment[]>;
    upload(leadId: string, files: any[], stage?: string, stageName?: string, a?: string): Promise<import("../database/entities").LeadAttachment[]>;
    link(leadId: string, dto: AddLinkDto & {
        stage?: string;
        stageName?: string;
    }, a?: string): Promise<import("../database/entities").LeadAttachment[]>;
    remove(leadId: string, attId: string): Promise<import("../database/entities").LeadAttachment[]>;
    content(leadId: string, attId: string, thumb: string, res: Response): Promise<void>;
}
