import type { Response } from 'express';
import { PeopleService } from './people.service';
import { ContactActivityService } from './contact-activity.service';
import type { SessionClaims } from '../auth/crypto.util';
import { CreatePersonDto } from './dto/create-person.dto';
import { AuthService } from '../auth/auth.service';
import { AttachmentsService } from '../google/attachments.service';
export declare class PeopleController {
    private readonly peopleService;
    private readonly auth;
    private readonly attachments;
    private readonly activity;
    constructor(peopleService: PeopleService, auth: AuthService, attachments: AttachmentsService, activity: ContactActivityService);
    findAll(project?: string): Promise<import("../database/entities").PersonEntity[]>;
    scanCard(files: {
        front?: any[];
        back?: any[];
    }, auth?: string): Promise<{
        cardToken: string;
        front: import("../database/task.types").TaskAttachment | null;
        back: import("../database/task.types").TaskAttachment | null;
        text: string;
        fields: import("./business-card").CardFields;
        readError: string;
    }>;
    addCard(id: string, files: {
        front?: any[];
        back?: any[];
    }, auth?: string): Promise<{
        businessCards: {
            front?: import("../database/task.types").TaskAttachment | null;
            back?: import("../database/task.types").TaskAttachment | null;
        };
        id: number;
        name: string;
        role: string;
        company: string;
        contact: string | null;
        kind: string;
        internalLevel: string;
        tier: string;
        phone: string;
        email: string;
        projects: string[];
        openTasks: number;
        employeeId: string;
        contractorId: string;
        userId: string;
        since: string;
        comply: unknown;
        last: string;
        contactStatus: string;
        contactStatusAt: string;
        contactStatusReason: string;
        lastActivityAt: string;
        sameAsIds: number[] | null;
        pointOfContact: boolean | null;
        formerCompanies: {
            company: string;
            personId?: number | null;
            role?: string | null;
            until?: string | null;
        }[] | null;
        firstName: string;
        lastName: string;
        goByName: string;
        pronouns: string;
        gender: string;
        categories: string[];
        addresses: Record<string, unknown>;
        contactInfo: Record<string, unknown>;
        licenses: unknown[];
        insurance: Record<string, unknown>;
        notLicensedDesigner: boolean | null;
    }>;
    removeCard(id: string, side: string): Promise<{
        businessCards: {
            front?: import("../database/task.types").TaskAttachment | null;
            back?: import("../database/task.types").TaskAttachment | null;
        };
        id: number;
        name: string;
        role: string;
        company: string;
        contact: string | null;
        kind: string;
        internalLevel: string;
        tier: string;
        phone: string;
        email: string;
        projects: string[];
        openTasks: number;
        employeeId: string;
        contractorId: string;
        userId: string;
        since: string;
        comply: unknown;
        last: string;
        contactStatus: string;
        contactStatusAt: string;
        contactStatusReason: string;
        lastActivityAt: string;
        sameAsIds: number[] | null;
        pointOfContact: boolean | null;
        formerCompanies: {
            company: string;
            personId?: number | null;
            role?: string | null;
            until?: string | null;
        }[] | null;
        firstName: string;
        lastName: string;
        goByName: string;
        pronouns: string;
        gender: string;
        categories: string[];
        addresses: Record<string, unknown>;
        contactInfo: Record<string, unknown>;
        licenses: unknown[];
        insurance: Record<string, unknown>;
        notLicensedDesigner: boolean | null;
    }>;
    cardContent(id: string, side: string, thumb: string, res: Response): Promise<void>;
    duplicates(q: Record<string, string>): Promise<(import("./contact-duplicates").DupRow & {
        matchedOn: import("./contact-duplicates").MatchedOn[];
    })[]>;
    activityOf(id: string): Promise<{
        interactions: import("../database/entities").ContactInteractionEntity[];
        bids: import("../database/entities").ContractorBidEntity[];
        lastInteractionAt: string | null;
        alerts: import("./contact-alerts").ContactAlert[];
        pointOfContact: {
            id: number;
            name: string;
        } | null;
    }>;
    logInteraction(id: string, body: {
        kind?: string;
        at?: string;
        note?: string;
    }, claims: SessionClaims | null): Promise<import("../database/entities").ContactInteractionEntity>;
    removeInteraction(id: string, interactionId: string): Promise<{
        deleted: boolean;
    }>;
    pointOfContact(id: string, body: {
        on?: boolean;
    }): Promise<import("../database/entities").PersonEntity>;
    link(id: string, otherId: string): Promise<{
        person: import("../database/entities").PersonEntity;
        other: import("../database/entities").PersonEntity;
    }>;
    unlink(id: string, otherId: string): Promise<import("../database/entities").PersonEntity>;
    findOne(id: string): Promise<import("../database/entities").PersonEntity>;
    create(dto: CreatePersonDto): Promise<import("../database/entities").PersonEntity>;
    update(id: string, dto: Partial<CreatePersonDto>): Promise<import("../database/entities").PersonEntity>;
    remove(id: string): Promise<{
        id: number;
        deleted: boolean;
    }>;
}
