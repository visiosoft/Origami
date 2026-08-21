import { Repository } from 'typeorm';
import { FileRoomFileEntity, FileRoomFolderEntity, ProjectEntity } from '../database/entities';
import { GoogleService } from '../google/google.service';
import type { UploadActor } from '../google/attachments.service';
export declare const DEFAULT_CATEGORIES: string[];
export declare const MAX_FILE_BYTES: number;
export declare const MAX_FILES_PER_UPLOAD = 20;
export declare class FileRoomService {
    private readonly files;
    private readonly folders;
    private readonly projects;
    private readonly google;
    private readonly log;
    constructor(files: Repository<FileRoomFileEntity>, folders: Repository<FileRoomFolderEntity>, projects: Repository<ProjectEntity>, google: GoogleService);
    private hydrate;
    list(projectId?: number): Promise<{
        projects: {
            id: number;
            name: string;
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
    rename(id: string, name: string): Promise<FileRoomFileEntity>;
    markLatest(id: string): Promise<FileRoomFileEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    createFolder(projectId: number, path: string[], name: string): Promise<FileRoomFolderEntity>;
    removeFolder(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
