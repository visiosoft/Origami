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
exports.LeadFilesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const attachments_service_1 = require("../google/attachments.service");
const task_types_1 = require("../database/task.types");
const clean = (v, max = 120) => String(v ?? '').replace(/[\r\n]/g, ' ').trim().slice(0, max);
let LeadFilesService = class LeadFilesService {
    constructor(repo, leads, attachments) {
        this.repo = repo;
        this.leads = leads;
        this.attachments = attachments;
    }
    async row(leadId) {
        return (await this.repo.findOneBy({ leadId })) || this.repo.create({ leadId, attachments: [] });
    }
    async list(leadId) {
        return (0, task_types_1.normalizeAttachments)((await this.repo.findOneBy({ leadId }))?.attachments);
    }
    async save(row, next) {
        row.attachments = next;
        row.updatedAt = new Date().toISOString();
        await this.repo.save(row);
        return next;
    }
    async folder(leadId) {
        const lead = await this.leads.findOneBy({ id: leadId });
        const name = clean(lead?.leadName || [lead?.firstName, lead?.lastName].filter(Boolean).join(' '), 80);
        return `Lead ${leadId}${name ? ` - ${name}` : ''}`;
    }
    tag(stage, stageName) {
        const key = clean(stage, 60);
        return key ? { stage: key, stageName: clean(stageName) || key } : {};
    }
    async addAttachments(leadId, files, actor, stage, stageName) {
        const row = await this.row(leadId);
        const added = (await this.attachments.upload(files, await this.folder(leadId), actor)).map((a) => ({ ...a, ...this.tag(stage, stageName) }));
        return this.save(row, [...(0, task_types_1.normalizeAttachments)(row.attachments), ...added]);
    }
    async addLink(leadId, name, url, actor, stage, stageName) {
        const row = await this.row(leadId);
        const att = {
            id: (0, task_types_1.subId)('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: new Date().toISOString(),
            ...this.tag(stage, stageName),
        };
        return this.save(row, [...(0, task_types_1.normalizeAttachments)(row.attachments), att]);
    }
    async removeAttachment(leadId, attId) {
        const row = await this.row(leadId);
        const all = (0, task_types_1.normalizeAttachments)(row.attachments);
        const target = all.find((a) => a.id === attId);
        if (!target)
            throw new common_1.NotFoundException('File not found');
        await this.attachments.discard(target);
        return this.save(row, all.filter((a) => a.id !== attId));
    }
    async attachment(leadId, attId) {
        const att = (await this.list(leadId)).find((a) => a.id === attId);
        if (!att)
            throw new common_1.NotFoundException('File not found');
        return att;
    }
};
exports.LeadFilesService = LeadFilesService;
exports.LeadFilesService = LeadFilesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.LeadFilesEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.LeadEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        attachments_service_1.AttachmentsService])
], LeadFilesService);
//# sourceMappingURL=lead-files.service.js.map