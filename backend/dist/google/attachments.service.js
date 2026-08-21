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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentsService = exports.MAX_FILES_PER_UPLOAD = exports.MAX_FILE_BYTES = void 0;
const common_1 = require("@nestjs/common");
const google_service_1 = require("./google.service");
const task_types_1 = require("../database/task.types");
const BLOCKED_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.ps1', '.sh', '.msi', '.scr', '.dll',
    '.js', '.jse', '.vbs', '.vbe', '.wsf', '.jar', '.html', '.htm', '.svg',
];
const INLINE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
exports.MAX_FILE_BYTES = 25 * 1024 * 1024;
exports.MAX_FILES_PER_UPLOAD = 10;
let AttachmentsService = class AttachmentsService {
    constructor(google) {
        this.google = google;
        this.log = new common_1.Logger('AttachmentsService');
    }
    static inlineSafe(mimeType) {
        return !!mimeType && INLINE_TYPES.includes(mimeType.split(';')[0].trim().toLowerCase());
    }
    assertAllowed(name) {
        const lower = (name || '').toLowerCase();
        const ext = lower.slice(lower.lastIndexOf('.'));
        if (BLOCKED_EXTENSIONS.includes(ext)) {
            throw new common_1.BadRequestException(`Files of type ${ext} can't be attached.`);
        }
    }
    async upload(files, scope, actor) {
        if (!files?.length)
            throw new common_1.BadRequestException('No files were uploaded.');
        if (!(await this.google.isConnected())) {
            throw new common_1.BadRequestException('No Google account is connected, so files cannot be stored. Connect one under Settings -> Integrations -> Google Workspace, or attach a link instead.');
        }
        if (files.length > exports.MAX_FILES_PER_UPLOAD) {
            throw new common_1.BadRequestException(`At most ${exports.MAX_FILES_PER_UPLOAD} files at a time.`);
        }
        const parentId = await this.google.folderForScope(scope);
        const out = [];
        for (const file of files) {
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
            out.push({
                id: (0, task_types_1.subId)('att'),
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
    async discard(att) {
        if (att?.kind !== 'drive' || !att.driveId)
            return;
        try {
            await this.google.trashDriveFile(att.driveId);
        }
        catch (err) {
            this.log.warn(`Could not trash ${att.driveId}: ${err.message}`);
        }
    }
    async discardAll(atts) {
        for (const att of atts ?? [])
            await this.discard(att);
    }
    download(att, thumb = false) {
        if (att.kind !== 'drive' || !att.driveId) {
            throw new common_1.BadRequestException('That attachment is a link, not a stored file.');
        }
        return this.google.downloadDriveFile(att.driveId, thumb);
    }
};
exports.AttachmentsService = AttachmentsService;
exports.AttachmentsService = AttachmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [google_service_1.GoogleService])
], AttachmentsService);
//# sourceMappingURL=attachments.service.js.map