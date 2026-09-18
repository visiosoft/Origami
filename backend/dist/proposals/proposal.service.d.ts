import { Repository } from 'typeorm';
import { ProposalEntity, DealEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { PipelineService } from '../pipeline/pipeline.service';
export interface ProposalActor {
    id?: string;
    name?: string;
}
export declare class ProposalService {
    private readonly repo;
    private readonly deals;
    private readonly settings;
    private readonly pipeline;
    private readonly log;
    constructor(repo: Repository<ProposalEntity>, deals: Repository<DealEntity>, settings: SettingsService, pipeline: PipelineService);
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
        reviewedAllPages: boolean;
        requiresSecondSignatory: boolean;
        signedAt2: string;
        signedByName2: string;
        signedByEmail2: string;
        signatureImage2: string;
    }>;
    save(dealId: string, body: {
        subject?: string;
        html?: string;
        amount?: string;
        requiresSecondSignatory?: boolean;
    }, actor?: ProposalActor): Promise<{
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
        reviewedAllPages: boolean;
        requiresSecondSignatory: boolean;
        signedAt2: string;
        signedByName2: string;
        signedByEmail2: string;
        signatureImage2: string;
    }>;
    signingLink(dealId: string): Promise<string>;
    markSent(dealId: string, to: string, actor?: ProposalActor): Promise<void>;
    private readToken;
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
        reviewedAllPages: boolean;
        requiresSecondSignatory: boolean;
        signedAt2: string;
        signedByName2: string;
        signedByEmail2: string;
        signatureImage2: string;
    }>;
    signByToken(token: string, signer: {
        name: string;
        email: string;
    }, image: string, meta: {
        ip: string;
        userAgent: string;
    }, reviewedAllPages: boolean, slot?: 1 | 2): Promise<{
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
        reviewedAllPages: boolean;
        requiresSecondSignatory: boolean;
        signedAt2: string;
        signedByName2: string;
        signedByEmail2: string;
        signatureImage2: string;
    }>;
}
