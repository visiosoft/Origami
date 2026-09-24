import { Repository } from 'typeorm';
import { CommitmentEntity, CommitmentLineEntity, ContractorEntity, CostEntryEntity, ProjectEntity, ProjectPhaseEntity, ProjectTaskEntity, UserEntity } from '../database/entities';
import type { SessionClaims } from '../auth/crypto.util';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import { type TaskAttachment } from '../database/task.types';
import type { Actor } from '../manpower/manpower-access.service';
import { FinancialsService } from './financials.service';
export declare class PortalService {
    private readonly contractors;
    private readonly commitments;
    private readonly lines;
    private readonly entries;
    private readonly projects;
    private readonly phases;
    private readonly tasks;
    private readonly users;
    private readonly fin;
    private readonly auth;
    private readonly settings;
    private readonly google?;
    private readonly attachments?;
    private readonly log;
    constructor(contractors: Repository<ContractorEntity>, commitments: Repository<CommitmentEntity>, lines: Repository<CommitmentLineEntity>, entries: Repository<CostEntryEntity>, projects: Repository<ProjectEntity>, phases: Repository<ProjectPhaseEntity>, tasks: Repository<ProjectTaskEntity>, users: Repository<UserEntity>, fin: FinancialsService, auth: AuthService, settings: SettingsService, google?: GoogleService | undefined, attachments?: AttachmentsService | undefined);
    private me;
    private mine;
    private figures;
    overview(claims: SessionClaims | null): Promise<{
        vendor: {
            name: string;
            contactPerson: string;
            email: string;
        };
        subcontracts: {
            id: string;
            number: string;
            title: string;
            status: string;
            dateIssued: string;
            projectId: number;
            projectName: string;
            committed: number;
            billed: number;
            submitted: number;
            approved: number;
            paid: number;
            toBePaid: number;
            remaining: number;
            milestones: number;
            sharedFiles: number;
        }[];
        totals: {
            committed: number;
            paid: number;
            awaitingApproval: number;
            approvedUnpaid: number;
            toBePaid: number;
        };
        recentInvoices: {
            id: string;
            reference: string;
            date: string;
            subcontractId: string | undefined;
            subcontractNumber: string | undefined;
            projectName: string | undefined;
            total: number;
            status: string;
            lines: {
                id: string;
                description: string;
                amount: number;
                status: string;
                returnedReason: string | undefined;
            }[];
            paidDate: string;
            paymentRef: string;
            returnedReason: string | undefined;
            fromPortal: boolean;
            submittedAt: string;
            files: {
                id: string;
                entryId: string;
                name: string;
                kind: "drive" | "link";
                url: string | undefined;
            }[];
        }[];
    }>;
    subcontract(claims: SessionClaims | null, id: string): Promise<{
        id: string;
        number: string;
        title: string;
        scope: string;
        status: string;
        dateIssued: string;
        projectName: string;
        committed: number;
        billed: number;
        paid: number;
        toBePaid: number;
        remaining: number;
        milestones: {
            id: string;
            description: string;
            amount: number;
            billed: number;
            paid: number;
            remaining: number;
            progress: {
                done: number;
                total: number;
            } | null;
            tasks: {
                id: string;
                title: string;
                status: string;
                notes: string;
            }[];
        }[];
        files: {
            id: string;
            name: string;
            kind: "drive" | "link";
            url: string | undefined;
            uploadedAt: string | undefined;
        }[];
        invoices: {
            id: string;
            reference: string;
            date: string;
            subcontractId: string | undefined;
            subcontractNumber: string | undefined;
            projectName: string | undefined;
            total: number;
            status: string;
            lines: {
                id: string;
                description: string;
                amount: number;
                status: string;
                returnedReason: string | undefined;
            }[];
            paidDate: string;
            paymentRef: string;
            returnedReason: string | undefined;
            fromPortal: boolean;
            submittedAt: string;
            files: {
                id: string;
                entryId: string;
                name: string;
                kind: "drive" | "link";
                url: string | undefined;
            }[];
        }[];
    }>;
    invoices(claims: SessionClaims | null): Promise<{
        id: string;
        reference: string;
        date: string;
        subcontractId: string | undefined;
        subcontractNumber: string | undefined;
        projectName: string | undefined;
        total: number;
        status: string;
        lines: {
            id: string;
            description: string;
            amount: number;
            status: string;
            returnedReason: string | undefined;
        }[];
        paidDate: string;
        paymentRef: string;
        returnedReason: string | undefined;
        fromPortal: boolean;
        submittedAt: string;
        files: {
            id: string;
            entryId: string;
            name: string;
            kind: "drive" | "link";
            url: string | undefined;
        }[];
    }[]>;
    private groupInvoices;
    submit(claims: SessionClaims | null, dto: {
        subcontractId?: string;
        reference?: string;
        date?: string;
        note?: string;
        lines?: {
            milestoneId: string;
            amount: number | string;
        }[];
    }): Promise<{
        batchId: string;
        invoices: {
            id: string;
            reference: string;
            date: string;
            subcontractId: string | undefined;
            subcontractNumber: string | undefined;
            projectName: string | undefined;
            total: number;
            status: string;
            lines: {
                id: string;
                description: string;
                amount: number;
                status: string;
                returnedReason: string | undefined;
            }[];
            paidDate: string;
            paymentRef: string;
            returnedReason: string | undefined;
            fromPortal: boolean;
            submittedAt: string;
            files: {
                id: string;
                entryId: string;
                name: string;
                kind: "drive" | "link";
                url: string | undefined;
            }[];
        }[];
    }>;
    attachToInvoice(claims: SessionClaims | null, batchId: string, files: any[], uploader: UploadActor): Promise<{
        id: string;
        reference: string;
        date: string;
        subcontractId: string | undefined;
        subcontractNumber: string | undefined;
        projectName: string | undefined;
        total: number;
        status: string;
        lines: {
            id: string;
            description: string;
            amount: number;
            status: string;
            returnedReason: string | undefined;
        }[];
        paidDate: string;
        paymentRef: string;
        returnedReason: string | undefined;
        fromPortal: boolean;
        submittedAt: string;
        files: {
            id: string;
            entryId: string;
            name: string;
            kind: "drive" | "link";
            url: string | undefined;
        }[];
    }[]>;
    file(claims: SessionClaims | null, where: {
        entryId?: string;
        subcontractId?: string;
    }, attId: string): Promise<TaskAttachment>;
    access(contractorId: string, actor: Actor): Promise<{
        contractorId: string;
        email: string;
        status: string;
        invitedAt: string | undefined;
        lastLogin: string | undefined;
    }>;
    invite(contractorId: string, dto: {
        email?: string;
        name?: string;
    }, actor: Actor): Promise<{
        invite: {
            sent: true;
            to: string;
            url: string;
            error?: undefined;
        } | {
            sent: false;
            to: string;
            url: string;
            error: string;
        };
        contractorId: string;
        email: string;
        status: string;
        invitedAt: string | undefined;
        lastLogin: string | undefined;
    }>;
    revoke(contractorId: string, actor: Actor): Promise<{
        contractorId: string;
        email: string;
        status: string;
        invitedAt: string | undefined;
        lastLogin: string | undefined;
    }>;
    private commitment;
    addAttachments(id: string, files: any[], actor: UploadActor): Promise<TaskAttachment[]>;
    addLink(id: string, name: string, url: string, actor: UploadActor): Promise<TaskAttachment[]>;
    removeAttachment(id: string, attId: string): Promise<TaskAttachment[]>;
    attachment(id: string, attId: string): Promise<TaskAttachment>;
    notifyStatus(entry: CostEntryEntity): Promise<void>;
}
