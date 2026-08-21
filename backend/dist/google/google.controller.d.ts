import type { Response } from 'express';
import { GoogleService } from './google.service';
import { SettingsService } from '../settings/settings.service';
import { AuthService } from '../auth/auth.service';
export declare class GoogleController {
    private readonly google;
    private readonly settings;
    private readonly auth;
    constructor(google: GoogleService, settings: SettingsService, auth: AuthService);
    status(): Promise<{
        configured: boolean;
        connected: boolean;
        connectedEmail: string;
        connectedAt: string;
        senderEmail: string;
        redirectUri: string;
        scopes: string[];
    }>;
    connect(res: Response): Promise<void>;
    login(res: Response): Promise<void>;
    callback(code: string, state: string, error: string, res: Response): Promise<void>;
    disconnect(): Promise<{
        configured: boolean;
        connected: boolean;
        connectedEmail: string;
        connectedAt: string;
        senderEmail: string;
        redirectUri: string;
        scopes: string[];
    }>;
    test(body: {
        to?: string;
    }): Promise<{
        sent: boolean;
        error: string;
        to?: undefined;
    } | {
        sent: boolean;
        to: string;
        error?: undefined;
    }>;
    send(body: {
        to: string;
        subject: string;
        html: string;
        cc?: string;
        bcc?: string;
    }): Promise<{
        id: string;
        threadId: string;
        from: string;
        to: string;
    }>;
    testDrive(): Promise<{
        ok: true;
        folderId: string;
    }>;
    files(q?: string): Promise<import("./google.service").DriveFile[]>;
}
