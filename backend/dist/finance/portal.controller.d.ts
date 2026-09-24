import type { Response } from 'express';
import type { SessionClaims } from '../auth/crypto.util';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService } from '../google/attachments.service';
import { ManpowerAccess } from '../manpower/manpower-access.service';
import { FinancialsService, type FinRights } from './financials.service';
import { FinanceFilesBase } from './finance.controller';
import { PortalService } from './portal.service';
export declare class PortalController {
    private readonly portal;
    private readonly attachments;
    constructor(portal: PortalService, attachments: AttachmentsService);
    overview(c: SessionClaims | null): Promise<{
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
    subcontract(id: string, c: SessionClaims | null): Promise<{
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
    invoices(c: SessionClaims | null): Promise<{
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
    submit(dto: any, c: SessionClaims | null): Promise<{
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
    attach(batchId: string, files: any[], c: SessionClaims | null): Promise<{
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
    billFile(entryId: string, attId: string, thumb: string, c: SessionClaims | null, res: Response): Promise<void>;
    sharedFile(id: string, attId: string, thumb: string, c: SessionClaims | null, res: Response): Promise<void>;
}
export declare class PortalAccessController {
    private readonly portal;
    private readonly access;
    constructor(portal: PortalService, access: ManpowerAccess);
    status(id: string, a?: string): Promise<{
        contractorId: string;
        email: string;
        status: string;
        invitedAt: string | undefined;
        lastLogin: string | undefined;
    }>;
    invite(id: string, dto: any, a?: string): Promise<{
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
    revoke(id: string, a?: string): Promise<{
        contractorId: string;
        email: string;
        status: string;
        invitedAt: string | undefined;
        lastLogin: string | undefined;
    }>;
}
export declare class SharedWithVendorFilesController extends FinanceFilesBase {
    private readonly portal;
    protected right: keyof FinRights;
    constructor(portal: PortalService, fin: FinancialsService, auth: AuthService, attachments: AttachmentsService, access: ManpowerAccess);
    protected owner(): PortalService;
}
