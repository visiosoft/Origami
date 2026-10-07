import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileRoomFileEntity, FileRoomFolderEntity, ProjectEntity } from '../database/entities';
import { GoogleService } from '../google/google.service';
import { subId } from '../database/task.types';
import type { UploadActor } from '../google/attachments.service';
import { SettingsService } from '../settings/settings.service';

const uniqueIds = (ids: unknown) => Array.from(new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean)));

export const FOLDER_TEMPLATE_KEY = 'fileRoom.folderTemplate';

/** "Drawings/Architectural" per line -> [['Drawings', 'Architectural'], ...]; blanks and duplicates dropped. */
export function parseFolderTemplate(text: string): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const line of String(text).split(/\r?\n/)) {
    const path = line.split('/').map((s) => s.trim()).filter(Boolean);
    const key = path.join('/').toLowerCase();
    if (!path.length || seen.has(key)) continue;
    seen.add(key);
    out.push(path);
  }
  return out;
}

/** Where the File Room keeps everything inside the connected account's Drive. */
const DRIVE_ROOT = 'Origami File Room';

/** The standard folders every project starts with; empty ones stay hidden. */
export const DEFAULT_CATEGORIES = [
  'Drawings & Plans',
  'Contracts & Permits',
  'Financial',
  'Photos',
  'Correspondence',
];

/** Executables and inline-script types are refused, as with task attachments. */
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.ps1', '.sh', '.msi', '.scr', '.dll',
  '.js', '.jse', '.vbs', '.vbe', '.wsf', '.jar', '.html', '.htm', '.svg',
];

export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 20;

const pathOf = (f: FileRoomFileEntity) => (f.folderPath ?? []).join('>');

const NEWLINE = new RegExp('\n', 'g');

/** Escape a note typed by a person before it goes into an HTML email. */
const escapeText = (t: string) =>
  String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
    .replace(NEWLINE, '<br/>');

const extOf = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot > -1 ? name.slice(dot + 1).toUpperCase() : '';
};

@Injectable()
export class FileRoomService {
  private readonly log = new Logger('FileRoomService');

  constructor(
    @InjectRepository(FileRoomFileEntity) private readonly files: Repository<FileRoomFileEntity>,
    @InjectRepository(FileRoomFolderEntity) private readonly folders: Repository<FileRoomFolderEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly google: GoogleService,
    private readonly settings: SettingsService,
  ) {}

  /** The standard folders every project gets: one path per line, '/' for subfolders. */
  async folderTemplate(): Promise<string[][]> {
    return parseFolderTemplate((await this.settings.get(FOLDER_TEMPLATE_KEY)) || '');
  }

  /**
   * Lay out the standard folders for a project, in Drive and in the File Room.
   * Safe to run again: folders already there are left alone.
   */
  async applyTemplate(projectId: number) {
    const template = await this.folderTemplate();
    if (!template.length) return { created: 0, template: 0 };
    if (!(await this.google.isConnected())) throw new BadRequestException('No Google account is connected.');
    const name = await this.projectName(projectId);
    const before = (await this.folders.find()).filter((f) => Number(f.projectId) === projectId).length;
    for (const path of template) {
      await this.google.folderForPath(DRIVE_ROOT, [name, ...path]);
      for (let i = 1; i <= path.length; i++) await this.createFolder(projectId, path.slice(0, i - 1), path[i - 1]);
    }
    const after = (await this.folders.find()).filter((f) => Number(f.projectId) === projectId).length;
    return { created: after - before, template: template.length };
  }

  private hydrate(f: FileRoomFileEntity): FileRoomFileEntity {
    return {
      ...f,
      folderPath: Array.isArray(f.folderPath) ? f.folderPath : [],
      size: Number(f.size) || 0,
      isLatest: f.isLatest !== false,
    } as FileRoomFileEntity;
  }

  /** Everything the browser needs to draw the tree in one call. */
  async list(projectId?: number) {
    const [rawFiles, rawFolders, projects] = await Promise.all([
      this.files.find(),
      this.folders.find(),
      this.projects.find(),
    ]);
    const scoped = projectId
      ? rawFiles.filter((f) => Number(f.projectId) === projectId)
      : rawFiles;
    return {
      projects: projects.map((p) => ({ id: p.id, name: p.name, syncedAt: p.fileRoomSyncedAt || null })),
      categories: DEFAULT_CATEGORIES,
      files: scoped.map((f) => this.hydrate(f)),
      folders: (projectId ? rawFolders.filter((f) => Number(f.projectId) === projectId) : rawFolders)
        .map((f) => ({ ...f, path: Array.isArray(f.path) ? f.path : [] })),
    };
  }

  private async projectName(projectId: number): Promise<string> {
    const project = await this.projects.findOneBy({ id: projectId });
    return project?.name || `Project ${projectId}`;
  }

  private assertAllowed(name: string) {
    const lower = (name || '').toLowerCase();
    const ext = lower.slice(lower.lastIndexOf('.'));
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(`Files of type ${ext} can't be stored here.`);
    }
  }

  // ---------------------------------------------------------------- uploads

  /**
   * Store files in Drive under `Origami File Room / <project> / <path…>` and
   * record them.
   *
   * Uploading a name that already exists in the same folder is treated as a new
   * revision rather than a duplicate: the two share a version group and the new
   * one becomes latest.
   */
  async upload(
    projectId: number,
    folderPath: string[],
    incoming: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }>,
    actor: UploadActor,
  ) {
    if (!incoming?.length) throw new BadRequestException('No files were uploaded.');
    if (!(await this.google.isConnected())) {
      throw new BadRequestException(
        'No Google account is connected, so files cannot be stored. Connect one under Settings -> Integrations -> Google Workspace.',
      );
    }
    if (incoming.length > MAX_FILES_PER_UPLOAD) {
      throw new BadRequestException(`At most ${MAX_FILES_PER_UPLOAD} files at a time.`);
    }

    const name = await this.projectName(projectId);
    const parentId = await this.google.folderForPath(DRIVE_ROOT, [name, ...folderPath]);
    const existing = (await this.files.find()).filter((f) => Number(f.projectId) === projectId);

    const saved: FileRoomFileEntity[] = [];
    for (const file of incoming) {
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

      // Same name, same folder → a new revision of that document.
      const sibling = existing.find(
        (f) => f.name === file.originalname && (f.folderPath ?? []).join('>') === folderPath.join('>'),
      );
      const groupId = sibling ? sibling.groupId || subId('grp') : null;
      if (sibling && groupId) {
        await this.files.update({ groupId }, { isLatest: false });
        if (!sibling.groupId) await this.files.update({ id: sibling.id }, { groupId, isLatest: false });
      }

      const row = this.files.create({
        id: subId('fr'),
        projectId,
        folderPath,
        name: file.originalname,
        ext: extOf(file.originalname),
        size: drive.size ? Number(drive.size) : file.size,
        mimeType: drive.mimeType || file.mimetype,
        driveId: drive.id,
        uploadedBy: actor.name,
        uploadedById: actor.id,
        updatedAt: new Date().toISOString(),
        groupId: groupId ?? undefined,
        isLatest: true,
      } as Partial<FileRoomFileEntity>);
      saved.push(await this.files.save(row));
      this.log.log(`Stored ${file.originalname} in ${[name, ...folderPath].join('/')}`);
    }
    return saved.map((f) => this.hydrate(f));
  }

  // ------------------------------------------------------------------ files

  private async load(id: string) {
    const file = await this.files.findOneBy({ id });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  /** Stream a file's bytes; the record is resolved first, never a bare Drive id. */
  async content(id: string, thumb = false) {
    const file = await this.load(id);
    if (!file.driveId) throw new NotFoundException('File has no stored content');
    const stream = await this.google.downloadDriveFile(file.driveId, thumb);
    return { file: this.hydrate(file), ...stream };
  }

  /**
   * Something the browser can show: images, PDFs and text as they are; Office
   * and Google documents as a PDF made by Drive. Null when there's no preview.
   */
  async preview(id: string) {
    const file = await this.load(id);
    if (!file.driveId) throw new NotFoundException('File has no stored content');
    const mime = file.mimeType || '';
    if (/^image\//.test(mime) || mime === 'application/pdf' || mime === 'text/plain') {
      return { file: this.hydrate(file), ...(await this.google.downloadDriveFile(file.driveId)), pdf: null as Buffer | null };
    }
    const pdf = await this.google.previewPdf(file.driveId, mime, file.name);
    return { file: this.hydrate(file), body: null, mimeType: 'application/pdf', pdf };
  }

  /**
   * Move a file (and its other revisions) to another folder of the same
   * project -- in Drive too, so the next sync doesn't put it back.
   */
  async move(id: string, folderPath: string[]) {
    const file = await this.load(id);
    const path = (Array.isArray(folderPath) ? folderPath : []).map((s) => String(s).trim()).filter(Boolean);
    const projectId = Number(file.projectId);
    const group = file.groupId
      ? (await this.files.find()).filter((f) => f.groupId === file.groupId && Number(f.projectId) === projectId)
      : [file];
    const folderId = await this.google.folderForPath(DRIVE_ROOT, [await this.projectName(projectId), ...path]);
    for (const f of group) {
      if (f.driveId) await this.google.updateDriveFile(f.driveId, { folderId });
      f.folderPath = path;
      f.updatedAt = new Date().toISOString();
      await this.files.save(f);
    }
    // Make sure the destination shows as a folder even if it was only just made.
    for (let i = 1; i <= path.length; i++) await this.createFolder(projectId, path.slice(0, i - 1), path[i - 1]);
    return this.hydrate(await this.load(id));
  }

  /** Rename and/or set the notes; whichever field is supplied is applied. */
  async update(id: string, patch: { name?: string; notes?: string }) {
    const file = await this.load(id);
    if (patch.name !== undefined) {
      const clean = patch.name.trim();
      if (!clean) throw new BadRequestException('A name is required.');
      this.assertAllowed(clean);
      // Rename in Drive as well, or the next sync would bring the old name back.
      if (file.driveId && clean !== file.name) await this.google.updateDriveFile(file.driveId, { name: clean });
      file.name = clean;
      file.ext = extOf(clean);
    }
    if (patch.notes !== undefined) file.notes = patch.notes;
    file.updatedAt = new Date().toISOString();
    return this.hydrate(await this.files.save(file));
  }

  /** Promote an older revision — only one file in a group is latest at a time. */
  async markLatest(id: string) {
    const file = await this.load(id);
    if (!file.groupId) {
      file.isLatest = true;
      return this.hydrate(await this.files.save(file));
    }
    await this.files.update({ groupId: file.groupId }, { isLatest: false });
    await this.files.update({ id }, { isLatest: true });
    return this.hydrate(await this.load(id));
  }

  async remove(id: string) {
    const file = await this.files.findOneBy({ id });
    if (!file) return { id, deleted: true };
    if (file.driveId) {
      try { await this.google.trashDriveFile(file.driveId); }
      catch (err) { this.log.warn(`Could not trash ${file.driveId}: ${(err as Error).message}`); }
    }
    await this.files.remove(file);
    // Losing the latest revision promotes the next most recent in its group.
    if (file.groupId && file.isLatest !== false) {
      const rest = (await this.files.find()).filter((f) => f.groupId === file.groupId);
      const next = rest.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
      if (next) await this.files.update({ id: next.id }, { isLatest: true });
    }
    return { id, deleted: true };
  }

  // ------------------------------------------------------------- share/email

  /** A link anyone can open — the caller warns the user before offering it. */
  async shareLink(id: string) {
    const file = await this.load(id);
    if (!file.driveId) throw new BadRequestException('That file has no stored content to share.');
    const url = await this.google.shareLink(file.driveId);
    return { url, name: file.name };
  }

  /** Email the file as a link rather than an attachment, so size never bites. */
  async email(id: string, to: string, note: string, actor: UploadActor) {
    const file = await this.load(id);
    if (!to?.trim()) throw new BadRequestException('A recipient is required.');
    const { url } = await this.shareLink(id);
    const project = await this.projectName(Number(file.projectId));
    const html = `
      <p>${actor.name} shared a file with you from the Origami File Room.</p>
      <p><strong>${file.name}</strong><br/>${project}${(file.folderPath ?? []).length ? ' &middot; ' + (file.folderPath ?? []).join(' / ') : ''}</p>
      ${note?.trim() ? `<p>${escapeText(note)}</p>` : ''}
      <p><a href="${url}">Open ${file.name}</a></p>
      <p style="color:#7E9B93;font-size:12px;">Anyone with this link can view the file.</p>`;
    await this.google.sendMail({ to: to.trim(), subject: `${file.name} — shared from Origami`, html });
    return { sent: true, to: to.trim(), url };
  }

  /** View links for several files at once. */
  async shareMany(ids: string[]) {
    const out: { id: string; name: string; url: string }[] = [];
    for (const id of uniqueIds(ids)) out.push({ id, ...(await this.shareLink(id)) });
    return out;
  }

  /** Several files in one email, each as a view link. */
  async emailMany(ids: string[], to: string, note: string, actor: UploadActor) {
    if (!to?.trim()) throw new BadRequestException('A recipient is required.');
    const links = await this.shareMany(ids);
    if (!links.length) throw new BadRequestException('Pick at least one file.');
    if (links.length === 1) return this.email(links[0].id, to, note, actor);
    const files = await Promise.all(links.map((l) => this.load(l.id)));
    const projects = Array.from(new Set(await Promise.all(files.map((f) => this.projectName(Number(f.projectId))))));
    const html = `
      <p>${actor.name} shared ${links.length} files with you from the Origami File Room${projects.length === 1 ? ` (${escapeText(projects[0])})` : ''}.</p>
      ${note?.trim() ? `<p>${escapeText(note)}</p>` : ''}
      <ul>${links.map((l) => `<li style="margin-bottom:6px;"><a href="${l.url}">${escapeText(l.name)}</a></li>`).join('')}</ul>
      <p style="color:#7E9B93;font-size:12px;">Anyone with these links can view the files.</p>`;
    await this.google.sendMail({ to: to.trim(), subject: `${links.length} files — shared from Origami`, html });
    return { sent: true, to: to.trim(), count: links.length };
  }

  /** Move several files (each with its versions) into one folder. */
  async moveMany(ids: string[], folderPath: string[]) {
    const target = (Array.isArray(folderPath) ? folderPath : []).map((s) => String(s).trim()).filter(Boolean).join('>');
    let moved = 0;
    const done = new Set<string>();
    for (const id of uniqueIds(ids)) {
      if (done.has(id)) continue;
      const file = await this.load(id);
      if ((file.folderPath ?? []).join('>') === target) continue;
      await this.move(id, folderPath);
      moved++;
      if (file.groupId) (await this.files.find()).filter((f) => f.groupId === file.groupId).forEach((f) => done.add(f.id));
    }
    return { moved };
  }

  // ----------------------------------------------------------------- sync

  /**
   * Reconcile with Drive so anything dropped straight into the project's folder
   * turns up here too.
   *
   * Drive is treated as the source of truth for what exists: files are matched
   * by Drive id, new ones are recorded with the folder path they were found in,
   * renames and size changes are picked up, and records whose file has gone are
   * dropped. Empty folders found in Drive are recorded so they don't vanish.
   */
  async sync(projectId: number) {
    if (!(await this.google.isConnected())) {
      throw new BadRequestException('No Google account is connected.');
    }
    const projectFolder = await this.google.folderForPath(DRIVE_ROOT, [await this.projectName(projectId)]);

    const seenDriveIds = new Set<string>();
    const known = (await this.files.find()).filter((f) => Number(f.projectId) === projectId);
    const byDriveId = new Map(known.filter((f) => f.driveId).map((f) => [f.driveId, f]));
    let added = 0, updated = 0, removed = 0, folders = 0;

    const walk = async (folderId: string, path: string[]) => {
      const children = await this.google.listChildren(folderId);
      for (const child of children) {
        if (GoogleService.isFolder(child)) {
          folders++;
          await this.createFolder(projectId, path, child.name);
          await walk(child.id, [...path, child.name]);
          continue;
        }
        seenDriveIds.add(child.id);
        const existing = byDriveId.get(child.id);
        const size = Number(child.size) || 0;
        if (existing) {
          const moved = pathOf(existing) !== path.join('>');
          if (existing.name !== child.name || Number(existing.size) !== size || moved) {
            existing.name = child.name;
            existing.ext = extOf(child.name);
            existing.size = size;
            existing.mimeType = child.mimeType;
            existing.folderPath = path;
            existing.updatedAt = child.modifiedTime || existing.updatedAt;
            await this.files.save(existing);
            updated++;
          }
        } else {
          await this.files.save(this.files.create({
            id: subId('fr'),
            projectId,
            folderPath: path,
            name: child.name,
            ext: extOf(child.name),
            size,
            mimeType: child.mimeType,
            driveId: child.id,
            uploadedBy: 'Google Drive',
            updatedAt: child.modifiedTime || new Date().toISOString(),
            isLatest: true,
          } as Partial<FileRoomFileEntity>));
          added++;
        }
      }
    };

    await walk(projectFolder, []);

    // Anything we knew about that Drive no longer has was deleted there.
    for (const file of known) {
      if (!file.driveId || seenDriveIds.has(file.driveId)) continue;
      await this.files.remove(file);
      removed++;
    }

    // New projects get the standard folders the first time they're synced.
    const project = await this.projects.findOneBy({ id: projectId });
    if (project && !project.fileRoomSyncedAt) await this.applyTemplate(projectId).catch((e) => this.log.warn(`Folder template: ${e?.message}`));
    const syncedAt = new Date().toISOString();
    await this.projects.update({ id: projectId }, { fileRoomSyncedAt: syncedAt });
    this.log.log(`Drive sync for project ${projectId}: +${added} ~${updated} -${removed}, ${folders} folders`);
    return { added, updated, removed, folders, syncedAt };
  }

  // ---------------------------------------------------------------- folders

  async createFolder(projectId: number, path: string[], name: string) {
    const clean = (name || '').trim();
    if (!clean) throw new BadRequestException('A folder name is required.');
    const full = [...path, clean];
    const existing = (await this.folders.find()).find(
      (f) => Number(f.projectId) === projectId && (f.path ?? []).join('>') === full.join('>'),
    );
    if (existing) return existing;
    return this.folders.save(
      this.folders.create({
        id: subId('frf'),
        projectId,
        path: full,
        name: clean,
        createdAt: new Date().toISOString(),
      } as Partial<FileRoomFolderEntity>),
    );
  }

  /** Removing a folder is refused while anything still lives inside it. */
  async removeFolder(id: string) {
    const folder = await this.folders.findOneBy({ id });
    if (!folder) return { id, deleted: true };
    const prefix = (folder.path ?? []).join('>');
    const held = (await this.files.find()).filter(
      (f) => Number(f.projectId) === Number(folder.projectId) && (f.folderPath ?? []).join('>').startsWith(prefix),
    );
    if (held.length) {
      throw new BadRequestException(`"${folder.name}" still holds ${held.length} file(s). Move or delete them first.`);
    }
    await this.folders.remove(folder);
    return { id, deleted: true };
  }
}
