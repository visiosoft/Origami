import { Repository } from 'typeorm';
import { FileRoomFileEntity, FileRoomFolderEntity, FileRoomShareEntity, ProjectEntity } from '../database/entities';
import { GoogleService } from '../google/google.service';
import type { UploadActor } from '../google/attachments.service';
import { SettingsService } from '../settings/settings.service';
export declare function recipients(to: string): string;
export declare const FOLDER_TEMPLATE_KEY = "fileRoom.folderTemplate";
export declare function parseFolderTemplate(text: string): string[][];
export declare const DEFAULT_CATEGORIES: string[];
export declare const MAX_FILE_BYTES: number;
export declare const MAX_FILES_PER_UPLOAD = 20;
export declare class FileRoomService {
    private readonly files;
    private readonly folders;
    private readonly projects;
    private readonly google;
    private readonly settings;
    private readonly shares;
    private readonly log;
    constructor(files: Repository<FileRoomFileEntity>, folders: Repository<FileRoomFolderEntity>, projects: Repository<ProjectEntity>, google: GoogleService, settings: SettingsService, shares: Repository<FileRoomShareEntity>);
    folderTemplate(): Promise<string[][]>;
    applyTemplate(projectId: number): Promise<{
        created: number;
        template: number;
    }>;
    private hydrate;
    list(projectId?: number): Promise<{
        projects: {
            id: number;
            name: string;
            syncedAt: string | null;
        }[];
        categories: string[];
        files: FileRoomFileEntity[];
        folders: {
            path: string[];
            id: string;
            projectId: number;
            name: string;
            createdAt: string;
        }[];
    }>;
    private projectName;
    private assertAllowed;
    upload(projectId: number, folderPath: string[], incoming: Array<{
        originalname: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
    }>, actor: UploadActor): Promise<FileRoomFileEntity[]>;
    private load;
    content(id: string, thumb?: boolean): Promise<{
        body: any;
        mimeType: string;
        size?: string;
        file: FileRoomFileEntity;
    }>;
    preview(id: string): Promise<{
        pdf: Buffer | null;
        body: any;
        mimeType: string;
        size?: string;
        file: FileRoomFileEntity;
    }>;
    move(id: string, folderPath: string[]): Promise<FileRoomFileEntity>;
    update(id: string, patch: {
        name?: string;
        notes?: string;
    }): Promise<FileRoomFileEntity>;
    markLatest(id: string): Promise<FileRoomFileEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    shareLink(id: string): Promise<{
        url: string;
        name: string;
    }>;
    email(id: string, to: string, note: string, actor: UploadActor): Promise<{
        sent: boolean;
        to: string;
        url: string;
    }>;
    shareMany(ids: string[]): Promise<{
        id: string;
        name: string;
        url: string;
    }[]>;
    emailMany(ids: string[], to: string, note: string, actor: UploadActor): Promise<{
        sent: boolean;
        to: string;
        url: string;
    } | {
        sent: boolean;
        to: string;
        count: number;
    }>;
    private logShare;
    shareHistory(opts: {
        projectId?: number;
        fileId?: string;
    }): Promise<FileRoomShareEntity[]>;
    moveMany(ids: string[], folderPath: string[]): Promise<{
        moved: number;
    }>;
    sync(projectId: number): Promise<{
        added: number;
        updated: number;
        removed: number;
        folders: number;
        syncedAt: string;
    }>;
    createFolder(projectId: number, path: string[], name: string): Promise<FileRoomFolderEntity>;
    removeFolder(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
