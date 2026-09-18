import type { Response } from 'express';
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
    pdf(body: {
        subject?: string;
        html?: string;
        amount?: string;
        dealName?: string;
    }, res: Response): Promise<Response<any, Record<string, any>>>;
    send(body: {
        dealId: string;
        to: string;
        cc?: string;
        extraAttachments?: {
            filename: string;
            mimeType?: string;
            contentBase64: string;
        }[];
    }, req: AuthedRequest): Promise<{
        ok: boolean;
        to: string;
        link: string;
        attachmentCount: number;
    }>;
    private renderPdf;
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
    pdfByToken(token: string, res: Response): Promise<Response<any, Record<string, any>>>;
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
