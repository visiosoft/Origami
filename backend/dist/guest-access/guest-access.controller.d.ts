import { GuestAccessService } from './guest-access.service';
import type { AuthedRequest } from '../auth/guards/session.guard';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
export declare class GuestAccessController {
    private readonly service;
    private readonly google;
    private readonly settings;
    constructor(service: GuestAccessService, google: GoogleService, settings: SettingsService);
    list(projectId?: string): Promise<{
        id: number;
        name: string;
        email: string;
        tier: string;
        projectId: number;
        createdAt: string;
        expiresAt: string;
        createdBy: string;
        revokedAt: string;
        lastUsedAt: string;
        expired: boolean;
        hasFullAccount: boolean;
    }[]>;
    create(body: {
        name: string;
        email: string;
        tier: 'client' | 'consultant';
        projectId: number;
        days?: number;
    }, req: AuthedRequest): Promise<{
        emailSent: boolean;
        emailError: string;
        id: number;
        name: string;
        email: string;
        tier: "client" | "consultant";
        projectId: number;
        projectName: string;
        expiresAt: string;
        link: string;
    } | {
        emailSent: boolean;
        id: number;
        name: string;
        email: string;
        tier: "client" | "consultant";
        projectId: number;
        projectName: string;
        expiresAt: string;
        link: string;
    }>;
    revoke(id: string): Promise<{
        id: number;
        revokedAt: string;
    }>;
    promote(id: string): Promise<{
        sent: true;
        to: string;
        url: string;
        error?: undefined;
    } | {
        sent: false;
        to: string;
        url: string;
        error: string;
    }>;
    resolve(token: string): Promise<{
        token: string;
        expiresIn: number;
        user: any;
    }>;
}
