import { Repository } from 'typeorm';
import { LeadEntity, LeadFilesEntity, type LeadAttachment } from '../database/entities';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
export declare class LeadFilesService {
    private readonly repo;
    private readonly leads;
    private readonly attachments;
    constructor(repo: Repository<LeadFilesEntity>, leads: Repository<LeadEntity>, attachments: AttachmentsService);
    private row;
    list(leadId: string): Promise<LeadAttachment[]>;
    private save;
    private folder;
    private tag;
    addAttachments(leadId: string, files: any[], actor: UploadActor, stage?: string, stageName?: string): Promise<LeadAttachment[]>;
    addLink(leadId: string, name: string, url: string, actor: UploadActor, stage?: string, stageName?: string): Promise<LeadAttachment[]>;
    removeAttachment(leadId: string, attId: string): Promise<LeadAttachment[]>;
    attachment(leadId: string, attId: string): Promise<LeadAttachment>;
}
