import { GoogleService } from './google.service';
import { type TaskAttachment } from '../database/task.types';
export declare const MAX_FILE_BYTES: number;
export declare const MAX_FILES_PER_UPLOAD = 10;
export interface UploadActor {
    name: string;
    id?: string;
}
export declare class AttachmentsService {
    private readonly google;
    private readonly log;
    constructor(google: GoogleService);
    static inlineSafe(mimeType?: string): boolean;
    private assertAllowed;
    upload(files: Array<{
        originalname: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
    }>, scope: string, actor: UploadActor): Promise<TaskAttachment[]>;
    discard(att: TaskAttachment | undefined): Promise<void>;
    discardAll(atts: TaskAttachment[] | undefined): Promise<void>;
    download(att: TaskAttachment, thumb?: boolean): Promise<{
        body: any;
        mimeType: string;
        size?: string;
    }>;
}
