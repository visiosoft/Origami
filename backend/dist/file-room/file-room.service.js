"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileRoomService = exports.MAX_FILES_PER_UPLOAD = exports.MAX_FILE_BYTES = exports.DEFAULT_CATEGORIES = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const google_service_1 = require("../google/google.service");
const task_types_1 = require("../database/task.types");
const DRIVE_ROOT = 'Origami File Room';
exports.DEFAULT_CATEGORIES = [
    'Drawings & Plans',
    'Contracts & Permits',
    'Financial',
    'Photos',
    'Correspondence',
];
const BLOCKED_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.ps1', '.sh', '.msi', '.scr', '.dll',
    '.js', '.jse', '.vbs', '.vbe', '.wsf', '.jar', '.html', '.htm', '.svg',
];
exports.MAX_FILE_BYTES = 100 * 1024 * 1024;
exports.MAX_FILES_PER_UPLOAD = 20;
const pathOf = (f) => (f.folderPath ?? []).join('>');
const NEWLINE = new RegExp('\n', 'g');
const escapeText = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
    .replace(NEWLINE, '<br/>');
const extOf = (name) => {
    const dot = name.lastIndexOf('.');
    return dot > -1 ? name.slice(dot + 1).toUpperCase() : '';
};
let FileRoomService = class FileRoomService {
    constructor(files, folders, projects, google) {
        this.files = files;
        this.folders = folders;
        this.projects = projects;
        this.google = google;
        this.log = new common_1.Logger('FileRoomService');
    }
    hydrate(f) {
        return {
            ...f,
            folderPath: Array.isArray(f.folderPath) ? f.folderPath : [],
            size: Number(f.size) || 0,
            isLatest: f.isLatest !== false,
        };
    }
    async list(projectId) {
        const [rawFiles, rawFolders, projects] = await Promise.all([
            this.files.find(),
            this.folders.find(),
            this.projects.find(),
        ]);
        const scoped = projectId
            ? rawFiles.filter((f) => Number(f.projectId) === projectId)
            : rawFiles;
        return {
            projects: projects.map((p) => ({ id: p.id, name: p.name })),
            categories: exports.DEFAULT_CATEGORIES,
            files: scoped.map((f) => this.hydrate(f)),
            folders: (projectId ? rawFolders.filter((f) => Number(f.projectId) === projectId) : rawFolders)
                .map((f) => ({ ...f, path: Array.isArray(f.path) ? f.path : [] })),
        };
    }
    async projectName(projectId) {
        const project = await this.projects.findOneBy({ id: projectId });
        return project?.name || `Project ${projectId}`;
    }
    assertAllowed(name) {
        const lower = (name || '').toLowerCase();
        const ext = lower.slice(lower.lastIndexOf('.'));
        if (BLOCKED_EXTENSIONS.includes(ext)) {
            throw new common_1.BadRequestException(`Files of type ${ext} can't be stored here.`);
        }
    }
    async upload(projectId, folderPath, incoming, actor) {
        if (!incoming?.length)
            throw new common_1.BadRequestException('No files were uploaded.');
        if (!(await this.google.isConnected())) {
            throw new common_1.BadRequestException('No Google account is connected, so files cannot be stored. Connect one under Settings -> Integrations -> Google Workspace.');
        }
        if (incoming.length > exports.MAX_FILES_PER_UPLOAD) {
            throw new common_1.BadRequestException(`At most ${exports.MAX_FILES_PER_UPLOAD} files at a time.`);
        }
        const name = await this.projectName(projectId);
        const parentId = await this.google.folderForPath(DRIVE_ROOT, [name, ...folderPath]);
        const existing = (await this.files.find()).filter((f) => Number(f.projectId) === projectId);
        const saved = [];
        for (const file of incoming) {
            this.assertAllowed(file.originalname);
            if (file.size > exports.MAX_FILE_BYTES) {
                throw new common_1.BadRequestException(`${file.originalname} is larger than ${exports.MAX_FILE_BYTES / 1024 / 1024} MB.`);
            }
            const drive = await this.google.uploadDriveFile({
                name: file.originalname,
                mimeType: file.mimetype,
                buffer: file.buffer,
                parentId,
            });
            const sibling = existing.find((f) => f.name === file.originalname && (f.folderPath ?? []).join('>') === folderPath.join('>'));
            const groupId = sibling ? sibling.groupId || (0, task_types_1.subId)('grp') : null;
            if (sibling && groupId) {
                await this.files.update({ groupId }, { isLatest: false });
                if (!sibling.groupId)
                    await this.files.update({ id: sibling.id }, { groupId, isLatest: false });
            }
            const row = this.files.create({
                id: (0, task_types_1.subId)('fr'),
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
            });
            saved.push(await this.files.save(row));
            this.log.log(`Stored ${file.originalname} in ${[name, ...folderPath].join('/')}`);
        }
        return saved.map((f) => this.hydrate(f));
    }
    async load(id) {
        const file = await this.files.findOneBy({ id });
        if (!file)
            throw new common_1.NotFoundException('File not found');
        return file;
    }
    async content(id, thumb = false) {
        const file = await this.load(id);
        if (!file.driveId)
            throw new common_1.NotFoundException('File has no stored content');
        const stream = await this.google.downloadDriveFile(file.driveId, thumb);
        return { file: this.hydrate(file), ...stream };
    }
    async update(id, patch) {
        const file = await this.load(id);
        if (patch.name !== undefined) {
            const clean = patch.name.trim();
            if (!clean)
                throw new common_1.BadRequestException('A name is required.');
            this.assertAllowed(clean);
            file.name = clean;
            file.ext = extOf(clean);
        }
        if (patch.notes !== undefined)
            file.notes = patch.notes;
        file.updatedAt = new Date().toISOString();
        return this.hydrate(await this.files.save(file));
    }
    async markLatest(id) {
        const file = await this.load(id);
        if (!file.groupId) {
            file.isLatest = true;
            return this.hydrate(await this.files.save(file));
        }
        await this.files.update({ groupId: file.groupId }, { isLatest: false });
        await this.files.update({ id }, { isLatest: true });
        return this.hydrate(await this.load(id));
    }
    async remove(id) {
        const file = await this.files.findOneBy({ id });
        if (!file)
            return { id, deleted: true };
        if (file.driveId) {
            try {
                await this.google.trashDriveFile(file.driveId);
            }
            catch (err) {
                this.log.warn(`Could not trash ${file.driveId}: ${err.message}`);
            }
        }
        await this.files.remove(file);
        if (file.groupId && file.isLatest !== false) {
            const rest = (await this.files.find()).filter((f) => f.groupId === file.groupId);
            const next = rest.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
            if (next)
                await this.files.update({ id: next.id }, { isLatest: true });
        }
        return { id, deleted: true };
    }
    async shareLink(id) {
        const file = await this.load(id);
        if (!file.driveId)
            throw new common_1.BadRequestException('That file has no stored content to share.');
        const url = await this.google.shareLink(file.driveId);
        return { url, name: file.name };
    }
    async email(id, to, note, actor) {
        const file = await this.load(id);
        if (!to?.trim())
            throw new common_1.BadRequestException('A recipient is required.');
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
    async sync(projectId) {
        if (!(await this.google.isConnected())) {
            throw new common_1.BadRequestException('No Google account is connected.');
        }
        const projectFolder = await this.google.folderForPath(DRIVE_ROOT, [await this.projectName(projectId)]);
        const seenDriveIds = new Set();
        const known = (await this.files.find()).filter((f) => Number(f.projectId) === projectId);
        const byDriveId = new Map(known.filter((f) => f.driveId).map((f) => [f.driveId, f]));
        let added = 0, updated = 0, removed = 0, folders = 0;
        const walk = async (folderId, path) => {
            const children = await this.google.listChildren(folderId);
            for (const child of children) {
                if (google_service_1.GoogleService.isFolder(child)) {
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
                }
                else {
                    await this.files.save(this.files.create({
                        id: (0, task_types_1.subId)('fr'),
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
                    }));
                    added++;
                }
            }
        };
        await walk(projectFolder, []);
        for (const file of known) {
            if (!file.driveId || seenDriveIds.has(file.driveId))
                continue;
            await this.files.remove(file);
            removed++;
        }
        this.log.log(`Drive sync for project ${projectId}: +${added} ~${updated} -${removed}, ${folders} folders`);
        return { added, updated, removed, folders };
    }
    async createFolder(projectId, path, name) {
        const clean = (name || '').trim();
        if (!clean)
            throw new common_1.BadRequestException('A folder name is required.');
        const full = [...path, clean];
        const existing = (await this.folders.find()).find((f) => Number(f.projectId) === projectId && (f.path ?? []).join('>') === full.join('>'));
        if (existing)
            return existing;
        return this.folders.save(this.folders.create({
            id: (0, task_types_1.subId)('frf'),
            projectId,
            path: full,
            name: clean,
            createdAt: new Date().toISOString(),
        }));
    }
    async removeFolder(id) {
        const folder = await this.folders.findOneBy({ id });
        if (!folder)
            return { id, deleted: true };
        const prefix = (folder.path ?? []).join('>');
        const held = (await this.files.find()).filter((f) => Number(f.projectId) === Number(folder.projectId) && (f.folderPath ?? []).join('>').startsWith(prefix));
        if (held.length) {
            throw new common_1.BadRequestException(`"${folder.name}" still holds ${held.length} file(s). Move or delete them first.`);
        }
        await this.folders.remove(folder);
        return { id, deleted: true };
    }
};
exports.FileRoomService = FileRoomService;
exports.FileRoomService = FileRoomService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.FileRoomFileEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.FileRoomFolderEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        google_service_1.GoogleService])
], FileRoomService);
//# sourceMappingURL=file-room.service.js.map