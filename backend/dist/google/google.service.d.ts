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
    thumbnailLink?: string;
    createdTime?: string;
}
export declare class GoogleService {
    private readonly settings;
    private readonly log;
    private accessToken;
    private folderIds;
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
    isConnected(): Promise<boolean>;
    private q;
    ensureFolder(name: string, parentId?: string): Promise<string>;
    attachmentsRootId(): Promise<string>;
    folderForScope(scope: string): Promise<string>;
    folderForPath(root: string, segments: string[]): Promise<string>;
    uploadDriveFile(opts: {
        name: string;
        mimeType: string;
        buffer: Buffer;
        parentId: string;
    }): Promise<DriveFile>;
    downloadDriveFile(id: string, thumb?: boolean): Promise<{
        body: any;
        mimeType: string;
        size?: string;
    }>;
    listChildren(folderId: string): Promise<DriveFile[]>;
    static isFolder(f: DriveFile): boolean;
    shareLink(id: string): Promise<string>;
    trashDriveFile(id: string): Promise<void>;
    testDrive(): Promise<{
        ok: true;
        folderId: string;
    }>;
    listDriveFiles(q?: string, pageSize?: number): Promise<DriveFile[]>;
}
