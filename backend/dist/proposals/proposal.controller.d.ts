import { ProposalService } from './proposal.service';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import type { AuthedRequest } from '../auth/guards/session.guard';
export declare class ProposalController {
    private readonly service;
    private readonly google;
    private readonly settings;
    constructor(service: ProposalService, google: GoogleService, settings: SettingsService);
    get(dealId: string): Promise<{
        dealId: string;
        dealName: string;
        subject: string;
        html: string;
        amount: string;
        updatedAt: string;
        updatedBy: string;
        sentAt: string;
        sentTo: string;
        signedAt: string;
        signedByName: string;
        signedByEmail: string;
        signatureImage: string;
    }>;
    save(body: {
        dealId: string;
        subject?: string;
        html?: string;
        amount?: string;
    }, req: AuthedRequest): Promise<{
        dealId: string;
        dealName: string;
        subject: string;
        html: string;
        amount: string;
        updatedAt: string;
        updatedBy: string;
        sentAt: string;
        sentTo: string;
        signedAt: string;
        signedByName: string;
        signedByEmail: string;
        signatureImage: string;
    }>;
    send(body: {
        dealId: string;
        to: string;
        cc?: string;
    }, req: AuthedRequest): Promise<{
        ok: boolean;
        to: string;
        link: string;
    }>;
    getByToken(token: string): Promise<{
        dealId: string;
        dealName: string;
        subject: string;
        html: string;
        amount: string;
        updatedAt: string;
        updatedBy: string;
        sentAt: string;
        sentTo: string;
        signedAt: string;
        signedByName: string;
        signedByEmail: string;
        signatureImage: string;
    }>;
    signByToken(body: {
        token: string;
        name: string;
        email?: string;
        image: string;
    }, req: AuthedRequest): Promise<{
        dealId: string;
        dealName: string;
        subject: string;
        html: string;
        amount: string;
        updatedAt: string;
        updatedBy: string;
        sentAt: string;
        sentTo: string;
        signedAt: string;
        signedByName: string;
        signedByEmail: string;
        signatureImage: string;
    }>;
}
