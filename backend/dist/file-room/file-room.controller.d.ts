import { ProjectAccessService } from '../auth/project-access.service';
import type { SessionClaims } from '../auth/crypto.util';
import type { Response } from 'express';
import { FileRoomService } from './file-room.service';
import { CreateFolderDto, UpdateFileDto, EmailFileDto, MoveFileDto, FileIdsDto, EmailFilesDto, MoveFilesDto } from './dto/file-room.dto';
import { AuthService } from '../auth/auth.service';
import { MarkupsService } from './markups.service';
export declare class FileRoomController {
    private readonly service;
    private readonly auth;
    private readonly access;
    private readonly markups;
    constructor(service: FileRoomService, auth: AuthService, access: ProjectAccessService, markups: MarkupsService);
    private seeFile;
    listMarkups(id: string, claims: SessionClaims | null): Promise<import("../database/entities").PdfMarkupEntity[]>;
    addMarkup(id: string, body: unknown, claims: SessionClaims | null): Promise<import("../database/entities").PdfMarkupEntity>;
    editMarkup(mid: string, body: unknown, claims: SessionClaims | null): Promise<import("../database/entities").PdfMarkupEntity>;
    removeMarkup(mid: string, claims: SessionClaims | null): Promise<{
        id: string;
        deleted: boolean;
    }>;
    markedUpPdf(id: string, res: Response, claims: SessionClaims | null, authors?: string): Promise<void>;
    markedUpCopy(id: string, body: {
        authors?: string[];
    }, claims: SessionClaims | null): Promise<import("../database/entities").FileRoomFileEntity>;
    list(projectId?: string, claims?: SessionClaims | null): Promise<{
        projects: {
            id: number;
            name: string;
            syncedAt: string | null;
        }[];
        categories: string[];
        files: import("../database/entities").FileRoomFileEntity[];
        folders: {
            path: string[];
            id: string;
            projectId: number;
            name: string;
            createdAt: string;
        }[];
    }>;
    upload(files: any[], projectId: string, path: string, auth?: string): Promise<import("../database/entities").FileRoomFileEntity[]>;
    shareHistory(projectId?: string, fileId?: string): Promise<import("../database/entities").FileRoomShareEntity[]>;
    shareMany(dto: FileIdsDto): Promise<{
        id: string;
        name: string;
        url: string;
    }[]>;
    emailMany(dto: EmailFilesDto, auth?: string): Promise<{
        sent: boolean;
        to: string;
        url: string;
    } | {
        sent: boolean;
        to: string;
        count: number;
    }>;
    moveMany(dto: MoveFilesDto): Promise<{
        moved: number;
    }>;
    content(id: string, thumb: string, download: string, res: Response, claims: SessionClaims | null, size?: string): Promise<void>;
    preview(id: string, res: Response, claims: SessionClaims | null): Promise<void>;
    template(projectId: string): Promise<{
        created: number;
        template: number;
    }>;
    move(id: string, dto: MoveFileDto): Promise<import("../database/entities").FileRoomFileEntity>;
    update(id: string, dto: UpdateFileDto): Promise<import("../database/entities").FileRoomFileEntity>;
    share(id: string): Promise<{
        url: string;
        name: string;
    }>;
    emailFile(id: string, dto: EmailFileDto, auth?: string): Promise<{
        sent: boolean;
        to: string;
        url: string;
    }>;
    sync(projectId: string): Promise<{
        added: number;
        updated: number;
        removed: number;
        folders: number;
        syncedAt: string;
    }>;
    markLatest(id: string): Promise<import("../database/entities").FileRoomFileEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    createFolder(dto: CreateFolderDto): Promise<import("../database/entities").FileRoomFolderEntity>;
    removeFolder(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
