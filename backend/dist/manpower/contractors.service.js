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
exports.ContractorsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const attachments_service_1 = require("../google/attachments.service");
const task_types_1 = require("../database/task.types");
const employee_records_service_1 = require("./employee-records.service");
const workforce_util_1 = require("./workforce.util");
let ContractorsService = class ContractorsService {
    constructor(repo, employees, attachments) {
        this.repo = repo;
        this.employees = employees;
        this.attachments = attachments;
    }
    hydrate(c, workerCount) {
        return {
            ...c,
            attachments: (0, task_types_1.normalizeAttachments)(c.attachments),
            contractStatus: (0, employee_records_service_1.expiryStatus)(c.contractEnd),
            insuranceStatus: (0, employee_records_service_1.expiryStatus)(c.insuranceExpiry),
            licenseStatus: (0, employee_records_service_1.expiryStatus)(c.licenseExpiry),
            tradeIds: c.tradeIds || [],
            workerCount,
        };
    }
    async counts() {
        const workers = await this.employees.find({ select: { id: true, contractorId: true } });
        const map = new Map();
        for (const w of workers)
            if (w.contractorId)
                map.set(w.contractorId, (map.get(w.contractorId) || 0) + 1);
        return map;
    }
    async findAll() {
        const [rows, counts] = await Promise.all([this.repo.find({ order: { companyName: 'ASC' } }), this.counts()]);
        return rows.map((c) => this.hydrate(c, counts.get(c.id) || 0));
    }
    async load(id) {
        const c = await this.repo.findOneBy({ id });
        if (!c)
            throw new common_1.NotFoundException(`Contractor ${id} not found`);
        return c;
    }
    async one(c) {
        return this.hydrate(c, (await this.counts()).get(c.id) || 0);
    }
    async create(dto) {
        if (!dto.companyName?.trim())
            throw new common_1.BadRequestException('A company name is required.');
        if (dto.contractStart && dto.contractEnd && dto.contractEnd < dto.contractStart)
            throw new common_1.BadRequestException('The contract ends before it starts.');
        const now = new Date().toISOString();
        const c = this.repo.create({ status: 'active', attachments: [], createdAt: now, updatedAt: now, ...dto, id: (0, workforce_util_1.newId)('CTR') });
        return this.one(await this.repo.save(c));
    }
    async update(id, dto) {
        const c = await this.load(id);
        const { attachments: _ignored, ...rest } = dto;
        Object.assign(c, rest, { id, updatedAt: new Date().toISOString() });
        if (c.contractStart && c.contractEnd && c.contractEnd < c.contractStart)
            throw new common_1.BadRequestException('The contract ends before it starts.');
        return this.one(await this.repo.save(c));
    }
    async remove(id) {
        const c = await this.load(id);
        const workers = await this.employees.count({ where: { contractorId: id } });
        if (workers)
            throw new common_1.BadRequestException(`${c.companyName} still has ${workers} worker(s) on record -- set the contractor to Ended instead.`);
        await this.attachments.discardAll((0, task_types_1.normalizeAttachments)(c.attachments));
        await this.repo.remove(c);
        return { id, deleted: true };
    }
    async addAttachments(id, files, actor) {
        const c = await this.load(id);
        const added = await this.attachments.upload(files, 'Contractors', actor);
        c.attachments = [...(0, task_types_1.normalizeAttachments)(c.attachments), ...added];
        return this.one(await this.repo.save(c));
    }
    async addLink(id, name, url, actor) {
        const c = await this.load(id);
        const att = { id: (0, task_types_1.subId)('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: new Date().toISOString() };
        c.attachments = [...(0, task_types_1.normalizeAttachments)(c.attachments), att];
        return this.one(await this.repo.save(c));
    }
    async removeAttachment(id, attId) {
        const c = await this.load(id);
        const all = (0, task_types_1.normalizeAttachments)(c.attachments);
        const target = all.find((a) => a.id === attId);
        if (!target)
            throw new common_1.NotFoundException('Attachment not found');
        await this.attachments.discard(target);
        c.attachments = all.filter((a) => a.id !== attId);
        return this.one(await this.repo.save(c));
    }
    async attachment(id, attId) {
        const c = await this.load(id);
        const att = (0, task_types_1.normalizeAttachments)(c.attachments).find((a) => a.id === attId);
        if (!att)
            throw new common_1.NotFoundException('Attachment not found');
        return att;
    }
};
exports.ContractorsService = ContractorsService;
exports.ContractorsService = ContractorsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ContractorEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        attachments_service_1.AttachmentsService])
], ContractorsService);
//# sourceMappingURL=contractors.service.js.map