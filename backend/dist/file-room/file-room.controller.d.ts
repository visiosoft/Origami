import type { Response } from 'express';
import { FileRoomService } from './file-room.service';
import { CreateFolderDto, UpdateFileDto, EmailFileDto } from './dto/file-room.dto';
import { AuthService } from '../auth/auth.service';
export declare class FileRoomController {
    private readonly service;
    private readonly auth;
    constructor(service: FileRoomService, auth: AuthService);
    list(projectId?: string): Promise<{
        projects: {
            id: number;
            name: string;
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
    content(id: string, thumb: string, download: string, res: Response): Promise<void>;
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
