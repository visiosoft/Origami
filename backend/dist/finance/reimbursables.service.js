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
exports.ReimbursablesService = exports.REIMB_CATEGORIES = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const attachments_service_1 = require("../google/attachments.service");
const task_types_1 = require("../database/task.types");
const workforce_util_1 = require("../manpower/workforce.util");
const financials_service_1 = require("./financials.service");
const invoices_service_1 = require("./invoices.service");
const money_1 = require("./money");
exports.REIMB_CATEGORIES = ['travel', 'printing', 'permits_fees', 'materials', 'consultants', 'shipping', 'equipment', 'other'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const now = () => new Date().toISOString();
let ReimbursablesService = class ReimbursablesService {
    constructor(repo, projects, fin, attachments) {
        this.repo = repo;
        this.projects = projects;
        this.fin = fin;
        this.attachments = attachments;
    }
    async load(id) {
        const r = await this.repo.findOneBy({ id });
        if (!r)
            throw new common_1.NotFoundException('Reimbursable not found');
        return r;
    }
    present(r) {
        const billC = (0, invoices_service_1.reimbursableBillC)(r);
        return { ...r, attachments: (0, task_types_1.normalizeAttachments)(r.attachments), markup: (0, money_1.fromCents)(billC - (0, money_1.toCents)(r.cost)), billAmount: (0, money_1.fromCents)(billC) };
    }
    async list(projectId, actor) {
        await this.fin.need(actor, 'viewReimbursables');
        return (await this.repo.find({ where: { projectId } })).map((r) => this.present(r)).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
    }
    async all(actor) {
        await this.fin.need(actor, 'viewReimbursables');
        const [rows, projects] = await Promise.all([this.repo.find(), this.projects.find()]);
        const name = new Map(projects.map((p) => [p.id, p.name]));
        return rows.map((r) => ({ ...this.present(r), projectName: name.get(r.projectId) || `Project ${r.projectId}` })).sort((a, b) => b.date.localeCompare(a.date));
    }
    async get(id, actor) {
        await this.fin.need(actor, 'viewReimbursables');
        return { ...this.present(await this.load(id)), approvals: await this.fin.approvalsFor(id) };
    }
    fields(r, dto) {
        if (dto.date !== undefined) {
            if (!ISO.test(dto.date || ''))
                throw new common_1.BadRequestException('Give the date of the expense.');
            r.date = dto.date;
        }
        if (dto.description !== undefined) {
            const d = String(dto.description || '').trim();
            if (!d)
                throw new common_1.BadRequestException('Describe the expense.');
            r.description = d;
        }
        if (dto.category !== undefined) {
            if (!exports.REIMB_CATEGORIES.includes(dto.category))
                throw new common_1.BadRequestException('Unknown category.');
            r.category = dto.category;
        }
        if (dto.cost !== undefined) {
            const c = (0, money_1.toCents)(dto.cost);
            if (!(c > 0))
                throw new common_1.BadRequestException('The cost must be more than zero.');
            r.cost = (0, money_1.fromCents)(c);
        }
        if (dto.markupPct !== undefined) {
            const n = Number(dto.markupPct);
            if (!Number.isFinite(n) || n < 0 || n > 100)
                throw new common_1.BadRequestException('Markup must be between 0 and 100%.');
            r.markupPct = (0, money_1.roundPct)(n);
        }
        for (const k of ['billable', 'taxable'])
            if (dto[k] !== undefined)
                r[k] = !!dto[k];
        for (const k of ['vendor', 'phaseId', 'csiCodeId', 'notes'])
            if (dto[k] !== undefined)
                r[k] = String(dto[k] ?? '').trim() || null;
    }
    async create(projectId, dto, actor) {
        await this.fin.need(actor, 'submitReimbursables');
        await this.fin.project(projectId);
        const { value: s } = await this.fin.settingsFor(projectId);
        let saved = null;
        for (let attempt = 0; attempt < 3 && !saved; attempt++) {
            const r = this.repo.create({
                id: (0, workforce_util_1.newId)('RE'), projectId, number: await this.fin.nextProjectNumber(this.repo, projectId, 'RE'), date: (0, workforce_util_1.todayISO)(), category: 'other',
                markupPct: Number(s.reimbursableMarkupPct) || 0, billable: true, taxable: false, status: 'submitted', submittedBy: actor.name, attachments: [],
                createdAt: now(), createdBy: actor.name,
            });
            this.fields(r, { date: dto.date || (0, workforce_util_1.todayISO)(), ...dto });
            if (!r.description)
                throw new common_1.BadRequestException('Describe the expense.');
            if (!r.cost)
                throw new common_1.BadRequestException('The cost must be more than zero.');
            try {
                saved = await this.repo.save(r);
            }
            catch (e) {
                if (attempt === 2)
                    throw e;
            }
        }
        await this.fin.approval(null, { projectId, entityType: 'reimbursable', entityId: saved.id, decision: 'submitted', amount: saved.cost }, actor);
        await this.fin.log(null, { projectId, entityType: 'reimbursable', entityId: saved.id, action: 'reimbursable_submitted', changes: { cost: { from: null, to: saved.cost } } }, actor);
        return this.get(saved.id, actor);
    }
    async update(id, dto, actor) {
        const r = await this.load(id);
        const rights = await this.fin.need(actor, 'submitReimbursables');
        if (r.status === 'billed')
            throw new common_1.BadRequestException('It has been billed -- credit the invoice line to correct it.');
        if (r.status === 'approved' && !rights.approveReimbursables)
            throw new common_1.BadRequestException('It has been approved -- ask an approver to change it.');
        (0, financials_service_1.assertVersion)(r, dto.version);
        const before = { ...r };
        this.fields(r, dto);
        if (r.status === 'rejected')
            Object.assign(r, { status: 'submitted', rejectedAt: null, rejectedBy: null, rejectedReason: null });
        Object.assign(r, { updatedAt: now(), updatedBy: actor.name });
        await this.repo.save(r);
        const changes = {};
        for (const k of ['cost', 'markupPct', 'billable', 'taxable', 'description', 'status'])
            if (String(before[k] ?? '') !== String(r[k] ?? ''))
                changes[k] = { from: before[k] ?? null, to: r[k] ?? null };
        await this.fin.log(null, { projectId: r.projectId, entityType: 'reimbursable', entityId: id, action: 'reimbursable_changed', changes }, actor);
        return this.get(id, actor);
    }
    async decide(id, dto, actor) {
        await this.fin.need(actor, 'approveReimbursables');
        const r = await this.load(id);
        (0, financials_service_1.assertVersion)(r, dto.version);
        if (r.status !== 'submitted')
            throw new common_1.BadRequestException(`This expense is ${r.status}.`);
        const at = now();
        if (dto.decision === 'approve')
            Object.assign(r, { status: 'approved', approvedAt: at, approvedBy: actor.name });
        else {
            if (!dto.reason?.trim())
                throw new common_1.BadRequestException('Say why it’s rejected.');
            Object.assign(r, { status: 'rejected', rejectedAt: at, rejectedBy: actor.name, rejectedReason: dto.reason.trim() });
        }
        Object.assign(r, { updatedAt: at, updatedBy: actor.name });
        await this.repo.save(r);
        await this.fin.approval(null, { projectId: r.projectId, entityType: 'reimbursable', entityId: id, decision: dto.decision === 'approve' ? 'approved' : 'rejected', comment: dto.reason, amount: (0, money_1.fromCents)((0, invoices_service_1.reimbursableBillC)(r)) }, actor);
        await this.fin.log(null, { projectId: r.projectId, entityType: 'reimbursable', entityId: id, action: dto.decision === 'approve' ? 'reimbursable_approved' : 'reimbursable_rejected', reason: dto.reason?.trim() }, actor);
        return this.get(id, actor);
    }
    async remove(id, actor) {
        await this.fin.need(actor, 'submitReimbursables');
        const r = await this.load(id);
        if (r.status === 'billed' || r.status === 'approved')
            throw new common_1.BadRequestException('Only an expense that hasn’t been approved can be deleted.');
        await this.repo.remove(r);
        await this.attachments?.discardAll((0, task_types_1.normalizeAttachments)(r.attachments));
        await this.fin.log(null, { projectId: r.projectId, entityType: 'reimbursable', entityId: id, action: 'reimbursable_deleted', changes: { number: { from: r.number, to: null } } }, actor);
        return { id, deleted: true };
    }
    async addAttachments(id, files, actor) {
        const r = await this.load(id);
        const added = await this.attachments.upload(files, `Project ${r.projectId}`, actor);
        r.attachments = [...(0, task_types_1.normalizeAttachments)(r.attachments), ...added];
        await this.repo.save(r);
        return (0, task_types_1.normalizeAttachments)(r.attachments);
    }
    async addLink(id, name, url, actor) {
        const r = await this.load(id);
        const att = { id: (0, task_types_1.subId)('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: now() };
        r.attachments = [...(0, task_types_1.normalizeAttachments)(r.attachments), att];
        await this.repo.save(r);
        return (0, task_types_1.normalizeAttachments)(r.attachments);
    }
    async removeAttachment(id, attId) {
        const r = await this.load(id);
        const all = (0, task_types_1.normalizeAttachments)(r.attachments);
        const target = all.find((a) => a.id === attId);
        if (!target)
            throw new common_1.NotFoundException('Attachment not found');
        await this.attachments.discard(target);
        r.attachments = all.filter((a) => a.id !== attId);
        await this.repo.save(r);
        return r.attachments;
    }
    async attachment(id, attId) {
        const att = (0, task_types_1.normalizeAttachments)((await this.load(id)).attachments).find((a) => a.id === attId);
        if (!att)
            throw new common_1.NotFoundException('Attachment not found');
        return att;
    }
};
exports.ReimbursablesService = ReimbursablesService;
exports.ReimbursablesService = ReimbursablesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ReimbursableEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        financials_service_1.FinancialsService,
        attachments_service_1.AttachmentsService])
], ReimbursablesService);
//# sourceMappingURL=reimbursables.service.js.map