import { Repository } from 'typeorm';
import { LeadEntity, LeadFilesEntity, UserEntity } from '../database/entities';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
export declare const UPLOAD_LINK_DAYS = 30;
export declare const CLIENT_UPLOAD_STAGE = "client_upload";
export declare function intakeSummary(l: Partial<LeadEntity>): [string, string][];
export declare class ClientWelcomeService {
    private readonly files;
    private readonly leads;
    private readonly users;
    private readonly attachments;
    private readonly google;
    private readonly settings;
    private readonly log;
    constructor(files: Repository<LeadFilesEntity>, leads: Repository<LeadEntity>, users: Repository<UserEntity>, attachments: AttachmentsService, google: GoogleService, settings: SettingsService);
    private row;
    private live;
    status(leadId: string): Promise<{
        sentAt: string | null;
        sentTo: string | null;
        sentBy: string | null;
        linkLive: boolean;
        expiresAt: string | null;
        items: string[];
        uploads: number;
    }>;
    private link;
    send(leadId: string, dto: {
        to?: string;
        note?: string;
        items?: string[];
    }, actor: UploadActor): Promise<{
        url: string;
        sentAt: string | null;
        sentTo: string | null;
        sentBy: string | null;
        linkLive: boolean;
        expiresAt: string | null;
        items: string[];
        uploads: number;
    }>;
    disable(leadId: string): Promise<{
        sentAt: string | null;
        sentTo: string | null;
        sentBy: string | null;
        linkLive: boolean;
        expiresAt: string | null;
        items: string[];
        uploads: number;
    }>;
    private resolve;
    publicView(token: string): Promise<{
        company: string;
        accent: string;
        project: string;
        firstName: string;
        items: string[];
        expiresAt: string;
        uploaded: {
            name: string;
            item: string;
            at: string | undefined;
        }[];
    }>;
    publicUpload(token: string, files: any[], item?: string): Promise<{
        company: string;
        accent: string;
        project: string;
        firstName: string;
        items: string[];
        expiresAt: string;
        uploaded: {
            name: string;
            item: string;
            at: string | undefined;
        }[];
    }>;
    private notify;
}
