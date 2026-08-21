import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GoogleService } from './google.service';
import { subId, type TaskAttachment } from '../database/task.types';

/**
 * Extensions we refuse outright. `.svg` and `.html` are here because they execute
 * script when a browser renders them inline; the rest are executables.
 */
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.ps1', '.sh', '.msi', '.scr', '.dll',
  '.js', '.jse', '.vbs', '.vbe', '.wsf', '.jar', '.html', '.htm', '.svg',
];

/** Types safe to hand back with `Content-Disposition: inline`. */
const INLINE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;

export interface UploadActor {
  name: string;
  id?: string;
}

@Injectable()
export class AttachmentsService {
  private readonly log = new Logger('AttachmentsService');

  constructor(private readonly google: GoogleService) {}

  /** Whether a file may be served inline rather than forced as a download. */
  static inlineSafe(mimeType?: string): boolean {
    return !!mimeType && INLINE_TYPES.includes(mimeType.split(';')[0].trim().toLowerCase());
  }

  private assertAllowed(name: string) {
    const lower = (name || '').toLowerCase();
    const ext = lower.slice(lower.lastIndexOf('.'));
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(`Files of type ${ext} can't be attached.`);
    }
  }

  /**
   * Push uploaded files into the scope's Drive folder and return the records to
   * store on the task.
   */
  async upload(
    files: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }>,
    scope: string,
    actor: UploadActor,
  ): Promise<TaskAttachment[]> {
    if (!files?.length) throw new BadRequestException('No files were uploaded.');
    if (!(await this.google.isConnected())) {
      throw new BadRequestException(
        'No Google account is connected, so files cannot be stored. Connect one under Settings -> Integrations -> Google Workspace, or attach a link instead.',
      );
    }
    if (files.length > MAX_FILES_PER_UPLOAD) {
      throw new BadRequestException(`At most ${MAX_FILES_PER_UPLOAD} files at a time.`);
    }

    const parentId = await this.google.folderForScope(scope);
    const out: TaskAttachment[] = [];
    for (const file of files) {
      this.assertAllowed(file.originalname);
      if (file.size > MAX_FILE_BYTES) {
        throw new BadRequestException(`${file.originalname} is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
      }
      const drive = await this.google.uploadDriveFile({
        name: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
        parentId,
      });
      out.push({
        id: subId('att'),
        name: drive.name || file.originalname,
        kind: 'drive',
        driveId: drive.id,
        webViewLink: drive.webViewLink,
        size: Number(drive.size) || file.size,
        mimeType: drive.mimeType || file.mimetype,
        uploadedBy: actor.name,
        uploadedById: actor.id,
        uploadedAt: new Date().toISOString(),
      });
      this.log.log(`Uploaded ${file.originalname} to ${scope}`);
    }
    return out;
  }

  /** Best-effort cleanup: an orphaned Drive file beats an orphaned task row. */
  async discard(att: TaskAttachment | undefined) {
    if (att?.kind !== 'drive' || !att.driveId) return;
    try {
      await this.google.trashDriveFile(att.driveId);
    } catch (err) {
      this.log.warn(`Could not trash ${att.driveId}: ${(err as Error).message}`);
    }
  }

  async discardAll(atts: TaskAttachment[] | undefined) {
    for (const att of atts ?? []) await this.discard(att);
  }

  /** Stream one attachment's bytes. The caller must have verified ownership. */
  download(att: TaskAttachment, thumb = false) {
    if (att.kind !== 'drive' || !att.driveId) {
      throw new BadRequestException('That attachment is a link, not a stored file.');
    }
    return this.google.downloadDriveFile(att.driveId, thumb);
  }
}
