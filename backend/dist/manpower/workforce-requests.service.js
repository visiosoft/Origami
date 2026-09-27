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
exports.WorkforceRequestsService = void 0;
exports.summarizeLines = summarizeLines;
exports.approverEmails = approverEmails;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const google_service_1 = require("../google/google.service");
const settings_service_1 = require("../settings/settings.service");
const shell_1 = require("../email/shell");
const manpower_access_service_1 = require("./manpower-access.service");
const assignments_service_1 = require("./assignments.service");
const workforce_util_1 = require("./workforce.util");
function summarizeLines(request, employees, openRegular, openAssignments) {
    return (request.lines || []).map((line) => {
        const allocated = openAssignments.filter((a) => a.workforceRequestId === request.id && a.requestLineId === line.id).length;
        const available = employees.filter((e) => e.tradeId === line.tradeId && (0, workforce_util_1.isDeployable)(e) && !openRegular.has(e.id)).length;
        return {
            ...line,
            allocated,
            available,
            shortage: Math.max(0, line.quantity - allocated),
            surplus: Math.max(0, allocated - line.quantity),
        };
    });
}
const EDITABLE = ['draft', 'rejected'];
function approverEmails(users, roles, requesterId) {
    const live = users.filter((u) => u.email && u.status !== 'suspended' && u.tier === 'internal' && u.id !== requesterId);
    const hr = live.filter((u) => u.roleKey !== 'admin' && roles.find((r) => r.key === u.roleKey)?.permissions?.[manpower_access_service_1.HR_MODULE]?.manage);
    const pick = hr.length ? hr : live.filter((u) => u.roleKey === 'admin');
    return Array.from(new Set(pick.map((u) => u.email.trim().toLowerCase())));
}
let WorkforceRequestsService = class WorkforceRequestsService {
    constructor(repo, employees, assignmentsRepo, projects, trades, assignments, users, roles, google, settings) {
        this.repo = repo;
        this.employees = employees;
        this.assignmentsRepo = assignmentsRepo;
        this.projects = projects;
        this.trades = trades;
        this.assignments = assignments;
        this.users = users;
        this.roles = roles;
        this.google = google;
        this.settings = settings;
        this.log = new common_1.Logger('WorkforceRequests');
    }
    notifySubmitted(id) {
        void (async () => {
            if (!this.users || !this.roles || !this.google || !this.settings)
                return;
            const r = await this.findOne(id);
            const to = approverEmails(await this.users.find(), await this.roles.find(), r.requestedById);
            if (!to.length)
                return;
            const [project, trades, brand, base] = await Promise.all([
                this.projects.findOneBy({ id: r.projectId }), this.trades.find(), (0, shell_1.loadEmailBrand)(this.settings), this.settings.baseUrl(),
            ]);
            const tradeName = (tid) => { const t = trades.find((x) => x.id === tid); return t ? `${t.code} ${t.name}` : 'Trade'; };
            const lines = r.lines.map((l) => `<li>${l.quantity} × ${(0, shell_1.escapeHtml)(tradeName(l.tradeId))}${l.designation ? ` — ${(0, shell_1.escapeHtml)(l.designation)}` : ''}</li>`).join('');
            const needed = new Date(r.requiredDate + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
            const body = `<div style="font-size:14px;color:#0B1A12;line-height:1.6;">
        <p style="margin:0 0 10px;"><b>${(0, shell_1.escapeHtml)(r.requestedByName || 'Someone')}</b> is asking for workers on <b>${(0, shell_1.escapeHtml)(project?.name || 'a project')}</b>${r.workArea ? ` (${(0, shell_1.escapeHtml)(r.workArea)})` : ''}, needed by <b>${needed}</b>${r.durationDays ? ` for ${r.durationDays} days` : ''}.</p>
        <ul style="margin:0 0 10px;padding-left:20px;">${lines}</ul>
        ${r.notes ? `<p style="margin:0;color:#43514D;white-space:pre-wrap;">${(0, shell_1.escapeHtml)(r.notes)}</p>` : ''}
      </div>`;
            await this.google.sendMail({
                to: to.join(', '),
                subject: `Workforce request: ${r.totals.required} worker${r.totals.required === 1 ? '' : 's'} for ${project?.name || 'a project'}`,
                html: (0, shell_1.emailShell)({ brand, eyebrow: 'Workforce request', title: 'Waiting for your approval', body, cta: { label: 'Review the request', url: `${base}/manpower_con?tab=requests` }, footer: 'You get this because you approve workforce requests in Manpower.' }),
            });
        })().catch((e) => this.log.warn(`Workforce request ${id} email failed: ${e.message}`));
    }
    async context() {
        const [employees, openRegular, linked] = await Promise.all([
            this.employees.find(),
            this.assignments.openRegularByEmployee(),
            this.assignmentsRepo.find({ where: { status: 'active' } }),
        ]);
        return { employees, openRegular, openLinked: linked.filter((a) => a.workforceRequestId && (0, workforce_util_1.isOpen)(a)) };
    }
    withSummary(r, ctx) {
        const lines = summarizeLines(r, ctx.employees, ctx.openRegular, ctx.openLinked);
        const required = lines.reduce((s, l) => s + l.quantity, 0);
        const allocated = lines.reduce((s, l) => s + Math.min(l.allocated, l.quantity), 0);
        return { ...r, lines, totals: { required, allocated, shortage: required - allocated } };
    }
    async findAll(opts) {
        const where = {};
        if (opts.projectId != null)
            where.projectId = opts.projectId;
        if (opts.status)
            where.status = opts.status;
        const [rows, ctx] = await Promise.all([this.repo.find({ where, order: { requiredDate: 'ASC' } }), this.context()]);
        return rows.map((r) => this.withSummary(r, ctx));
    }
    async findOne(id) {
        const [r, ctx] = await Promise.all([this.load(id), this.context()]);
        return this.withSummary(r, ctx);
    }
    async load(id) {
        const r = await this.repo.findOneBy({ id });
        if (!r)
            throw new common_1.NotFoundException(`Workforce request ${id} not found`);
        return r;
    }
    async cleanLines(lines) {
        const clean = (lines || []).filter((l) => l && l.tradeId);
        if (!clean.length)
            throw new common_1.BadRequestException('Add at least one line: a trade and how many workers.');
        const trades = await this.trades.find();
        return clean.map((l) => {
            const qty = Number(l.quantity);
            if (!Number.isInteger(qty) || qty < 1)
                throw new common_1.BadRequestException('Each line needs a whole number of workers, at least 1.');
            if (!trades.some((t) => t.id === l.tradeId))
                throw new common_1.BadRequestException(`Unknown trade ${l.tradeId}.`);
            return { id: l.id || (0, workforce_util_1.newId)('WRL'), tradeId: l.tradeId, designation: l.designation || undefined, quantity: qty };
        });
    }
    async create(dto, actor) {
        if (!(await this.projects.findOneBy({ id: Number(dto.projectId) })))
            throw new common_1.BadRequestException('Pick a project.');
        if (!dto.requiredDate)
            throw new common_1.BadRequestException('When are the workers needed?');
        const now = new Date().toISOString();
        const r = this.repo.create({
            id: (0, workforce_util_1.newId)('WR'), projectId: Number(dto.projectId), workArea: dto.workArea, requiredDate: dto.requiredDate,
            durationDays: dto.durationDays ?? null, notes: dto.notes, lines: await this.cleanLines(dto.lines),
            status: dto.submit ? 'submitted' : 'draft', submittedAt: dto.submit ? now : undefined,
            requestedById: actor.id, requestedByName: actor.name, createdAt: now, updatedAt: now,
        });
        const saved = await this.repo.save(r);
        if (dto.submit)
            this.notifySubmitted(saved.id);
        return this.findOne(saved.id);
    }
    async update(id, dto) {
        const r = await this.load(id);
        if (!EDITABLE.includes(r.status))
            throw new common_1.BadRequestException(`A ${r.status} request can no longer be edited.`);
        if (dto.projectId != null) {
            if (!(await this.projects.findOneBy({ id: Number(dto.projectId) })))
                throw new common_1.BadRequestException('Pick a project.');
            r.projectId = Number(dto.projectId);
        }
        for (const k of ['workArea', 'requiredDate', 'durationDays', 'notes']) {
            if (dto[k] !== undefined)
                r[k] = dto[k];
        }
        if (dto.lines !== undefined)
            r.lines = await this.cleanLines(dto.lines);
        r.status = 'draft';
        r.updatedAt = new Date().toISOString();
        await this.repo.save(r);
        return this.findOne(id);
    }
    async transition(id, from, to, extra = {}) {
        const r = await this.load(id);
        if (!from.includes(r.status))
            throw new common_1.BadRequestException(`Cannot move a ${r.status} request to ${to}.`);
        Object.assign(r, extra, { status: to, updatedAt: new Date().toISOString() });
        await this.repo.save(r);
        return this.findOne(id);
    }
    async submit(id) {
        const r = await this.transition(id, EDITABLE, 'submitted', { submittedAt: new Date().toISOString(), decisionNote: undefined });
        this.notifySubmitted(id);
        return r;
    }
    async approve(id, note, actor) {
        const r = await this.load(id);
        if (actor.id && actor.id === r.requestedById)
            throw new common_1.ForbiddenException("You can't approve your own request.");
        return this.transition(id, ['submitted'], 'approved', { decidedByName: actor.name, decidedAt: new Date().toISOString(), decisionNote: note || '' });
    }
    async reject(id, note, actor) {
        const r = await this.load(id);
        if (actor.id && actor.id === r.requestedById)
            throw new common_1.ForbiddenException("You can't reject your own request.");
        return this.transition(id, ['submitted'], 'rejected', { decidedByName: actor.name, decidedAt: new Date().toISOString(), decisionNote: note || '' });
    }
    cancel(id, actor) {
        return this.transition(id, ['draft', 'submitted', 'approved', 'rejected'], 'cancelled', { decidedByName: actor.name, decidedAt: new Date().toISOString() });
    }
    fulfill(id, actor) {
        return this.transition(id, ['approved'], 'fulfilled', { decidedByName: actor.name, decidedAt: new Date().toISOString() });
    }
    async allocate(id, dto, actor) {
        const r = await this.load(id);
        if (r.status !== 'approved')
            throw new common_1.BadRequestException('Only an approved request can be allocated.');
        const line = (r.lines || []).find((l) => l.id === dto.lineId);
        if (!line)
            throw new common_1.BadRequestException('That line is not on this request.');
        await this.assignments.assign({
            employeeIds: dto.employeeIds, projectId: r.projectId, workArea: dto.workArea ?? r.workArea,
            startDate: dto.startDate || (r.requiredDate > new Date().toISOString().slice(0, 10) ? r.requiredDate : undefined),
            designation: line.designation, assignmentType: 'regular', workforceRequestId: r.id, requestLineId: line.id,
        }, actor);
        const updated = await this.findOne(id);
        if (updated.lines.every((l) => l.allocated >= l.quantity)) {
            return this.transition(id, ['approved'], 'fulfilled', { decidedByName: actor.name, decidedAt: new Date().toISOString() });
        }
        return updated;
    }
    async remove(id) {
        const r = await this.load(id);
        if (!['draft', 'cancelled', 'rejected'].includes(r.status))
            throw new common_1.BadRequestException('Cancel the request instead -- it has been acted on.');
        await this.repo.remove(r);
        return { id, deleted: true };
    }
};
exports.WorkforceRequestsService = WorkforceRequestsService;
exports.WorkforceRequestsService = WorkforceRequestsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.WorkforceRequestEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.EmployeeAssignmentEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.SubcontractorTradeEntity)),
    __param(6, (0, common_1.Optional)()),
    __param(6, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __param(7, (0, common_1.Optional)()),
    __param(7, (0, typeorm_1.InjectRepository)(entities_1.RoleEntity)),
    __param(8, (0, common_1.Optional)()),
    __param(9, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        assignments_service_1.AssignmentsService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        google_service_1.GoogleService,
        settings_service_1.SettingsService])
], WorkforceRequestsService);
//# sourceMappingURL=workforce-requests.service.js.map