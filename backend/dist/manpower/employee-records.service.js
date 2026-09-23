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
exports.EmployeeRecordsService = exports.EXPIRING_WITHIN_DAYS = void 0;
exports.expiryStatus = expiryStatus;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const attachments_service_1 = require("../google/attachments.service");
const task_types_1 = require("../database/task.types");
exports.EXPIRING_WITHIN_DAYS = 30;
function expiryStatus(expiryDate, today = new Date()) {
    if (!expiryDate)
        return 'none';
    const expiry = new Date(expiryDate + 'T00:00:00');
    if (Number.isNaN(expiry.getTime()))
        return 'none';
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const days = Math.round((expiry.getTime() - start.getTime()) / 86400000);
    if (days < 0)
        return 'expired';
    if (days <= exports.EXPIRING_WITHIN_DAYS)
        return 'expiring';
    return 'valid';
}
let EmployeeRecordsService = class EmployeeRecordsService {
    constructor(repo, attachments) {
        this.repo = repo;
        this.attachments = attachments;
    }
    hydrate(r) {
        return { ...r, attachments: (0, task_types_1.normalizeAttachments)(r.attachments), expiryStatus: expiryStatus(r.expiryDate) };
    }
    async findAll(opts) {
        const where = {};
        if (opts.employeeId)
            where.employeeId = opts.employeeId;
        if (opts.kind)
            where.kind = opts.kind;
        const rows = await this.repo.find({ where, order: { createdAt: 'DESC' } });
        return rows.map((r) => this.hydrate(r));
    }
    async load(id) {
        const record = await this.repo.findOneBy({ id });
        if (!record)
            throw new common_1.NotFoundException(`Record ${id} not found`);
        return record;
    }
    async create(dto) {
        const now = new Date().toISOString();
        const record = this.repo.create({
            attachments: [], createdAt: now, updatedAt: now,
            ...dto,
            id: 'ER-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
        });
        return this.hydrate(await this.repo.save(record));
    }
    async update(id, dto) {
        const record = await this.load(id);
        const { attachments: _ignored, ...rest } = dto;
        Object.assign(record, rest, { id, updatedAt: new Date().toISOString() });
        return this.hydrate(await this.repo.save(record));
    }
    async remove(id) {
        const record = await this.repo.findOneBy({ id });
        if (record) {
            await this.attachments.discardAll((0, task_types_1.normalizeAttachments)(record.attachments));
            await this.repo.remove(record);
        }
        return { id, deleted: true };
    }
    async addAttachments(id, files, actor) {
        const record = await this.load(id);
        const added = await this.attachments.upload(files, 'Employee Records', actor);
        record.attachments = [...(0, task_types_1.normalizeAttachments)(record.attachments), ...added];
        record.updatedAt = new Date().toISOString();
        return this.hydrate(await this.repo.save(record));
    }
    async addLink(id, name, url, actor) {
        const record = await this.load(id);
        const att = { id: (0, task_types_1.subId)('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: new Date().toISOString() };
        record.attachments = [...(0, task_types_1.normalizeAttachments)(record.attachments), att];
        return this.hydrate(await this.repo.save(record));
    }
    async removeAttachment(id, attId) {
        const record = await this.load(id);
        const all = (0, task_types_1.normalizeAttachments)(record.attachments);
        const target = all.find((a) => a.id === attId);
        if (!target)
            throw new common_1.NotFoundException('Attachment not found');
        await this.attachments.discard(target);
        record.attachments = all.filter((a) => a.id !== attId);
        return this.hydrate(await this.repo.save(record));
    }
    async attachment(id, attId) {
        const record = await this.load(id);
        const att = (0, task_types_1.normalizeAttachments)(record.attachments).find((a) => a.id === attId);
        if (!att)
            throw new common_1.NotFoundException('Attachment not found');
        return att;
    }
};
exports.EmployeeRecordsService = EmployeeRecordsService;
exports.EmployeeRecordsService = EmployeeRecordsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.EmployeeRecordEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        attachments_service_1.AttachmentsService])
], EmployeeRecordsService);
//# sourceMappingURL=employee-records.service.js.map