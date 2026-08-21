import { SettingsService } from '../settings/settings.service';
export declare const WORKSPACE_SCOPES: string[];
export declare const LOGIN_SCOPES: string[];
export interface GoogleProfile {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
    email_verified?: boolean;
}
export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    size?: string;
    webViewLink?: string;
    iconLink?: string;
}
export declare class GoogleService {
    private readonly settings;
    private readonly log;
    private accessToken;
    constructor(settings: SettingsService);
    credentials(): Promise<{
        clientId: string;
        clientSecret: string;
        redirectUri: string;
    }>;
    isConfigured(): Promise<boolean>;
    redirectUri(): Promise<string>;
    consentUrl(mode: 'connect' | 'login', state: string): Promise<string>;
    exchangeCode(code: string): Promise<{
        access_token: string;
        refresh_token?: string;
        expires_in: number;
    }>;
    profile(accessToken: string): Promise<GoogleProfile>;
    saveConnection(refreshToken: string | undefined, profile: GoogleProfile): Promise<void>;
    disconnect(): Promise<void>;
    status(): Promise<{
        configured: boolean;
        connected: boolean;
        connectedEmail: string;
        connectedAt: string;
        senderEmail: string;
        redirectUri: string;
        scopes: string[];
    }>;
    workspaceToken(): Promise<string>;
    sendMail(opts: {
        to: string;
        subject: string;
        html: string;
        text?: string;
        cc?: string;
        bcc?: string;
    }): Promise<{
        id: string;
        threadId: string;
        from: string;
        to: string;
    }>;
    listDriveFiles(q?: string, pageSize?: number): Promise<DriveFile[]>;
}
