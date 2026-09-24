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
exports.FinancialsService = exports.BILLING_METHODS = exports.PM_MODULE = exports.FIN_MODULE = void 0;
exports.assertVersion = assertVersion;
exports.parseAmount = parseAmount;
exports.billToFromLead = billToFromLead;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const manpower_access_service_1 = require("../manpower/manpower-access.service");
const settings_service_1 = require("../settings/settings.service");
const letterhead_1 = require("../documents/letterhead");
const programme_template_1 = require("../seed-data/programme-template");
const workforce_util_1 = require("../manpower/workforce.util");
const finance_calc_1 = require("./finance.calc");
const money_1 = require("./money");
exports.FIN_MODULE = 'fin_project';
exports.PM_MODULE = 'pm';
exports.BILLING_METHODS = ['fixed', 'percent_complete', 'quantity', 't_and_m', 'reimbursable', 'milestone', 'manual'];
const now = () => new Date().toISOString();
function assertVersion(row, version) {
    if (!row)
        return;
    if (version == null || Number(version) !== Number(row.version)) {
        throw new common_1.ConflictException(`This was changed${row.updatedBy ? ` by ${row.updatedBy}` : ''} since you opened it -- reload and try again.`);
    }
}
const pctIn = (v, name) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100)
        throw new common_1.BadRequestException(`${name} must be between 0 and 100.`);
    return (0, money_1.roundPct)(n);
};
const moneyIn = (v, name) => {
    if (v === null || v === '' || v === undefined)
        return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1e13)
        throw new common_1.BadRequestException(`${name} must be a positive amount.`);
    return (0, money_1.fromCents)((0, money_1.toCents)(n));
};
const fmtUsd = (c) => '$' + Math.round(c / 100).toLocaleString('en-US');
let FinancialsService = class FinancialsService {
    constructor(projects, leads, phases, tasks, pfin, phfin, tfin, progress, invoices, lines, payments, activityRepo, settings, access) {
        this.projects = projects;
        this.leads = leads;
        this.phases = phases;
        this.tasks = tasks;
        this.pfin = pfin;
        this.phfin = phfin;
        this.tfin = tfin;
        this.progress = progress;
        this.invoices = invoices;
        this.lines = lines;
        this.payments = payments;
        this.activityRepo = activityRepo;
        this.settings = settings;
        this.access = access;
    }
    async rights(actor) {
        const [view, manage, pm] = await Promise.all([
            this.access.can(actor, exports.FIN_MODULE, 'view'), this.access.can(actor, exports.FIN_MODULE, 'manage'), this.access.can(actor, exports.PM_MODULE, 'manage'),
        ]);
        return { view: view || manage, manage, reportProgress: manage || pm, approveProgress: manage };
    }
    async need(actor, what) {
        const r = await this.rights(actor);
        if (!r[what])
            throw new common_1.ForbiddenException(what === 'view' ? "Your role doesn't include project financials." : "Your role doesn't allow changing project financials.");
        return r;
    }
    async log(m, e, actor) {
        const repo = m ? m.getRepository(entities_1.FinanceActivityEntity) : this.activityRepo;
        await repo.save(repo.create({ id: (0, workforce_util_1.newId)('FA'), ...e, changes: e.changes && Object.keys(e.changes).length ? e.changes : null, byName: actor.name, byId: actor.id, at: now() }));
    }
    diff(row, patch) {
        const out = {};
        for (const [k, v] of Object.entries(patch)) {
            const before = row[k];
            if (v !== undefined && String(before ?? '') !== String(v ?? ''))
                out[k] = { from: before ?? null, to: v ?? null };
        }
        return out;
    }
    async library() {
        try {
            const lib = (0, programme_template_1.parseLibrary)(await this.settings.get('programme.templates'));
            if (lib)
                return lib;
        }
        catch { }
        try {
            const legacy = (0, programme_template_1.parseProgramme)(await this.settings.get('programme.template'));
            if (legacy)
                return [{ key: programme_template_1.DEFAULT_TEMPLATE_KEY, name: 'Default', phases: legacy, category: 'design' }];
        }
        catch { }
        return programme_template_1.DEFAULT_LIBRARY;
    }
    async categories(project) {
        const lib = await this.library();
        const construction = new Set();
        const design = new Set();
        for (const t of lib)
            for (const ph of t.phases)
                ((t.category || 'design') === 'construction' ? construction : design).add(ph.key);
        const own = project.templateKey ? lib.find((t) => t.key === project.templateKey) : undefined;
        return (key) => (construction.has(key) || (own?.category === 'construction' && own.phases.some((p) => p.key === key)) ? 'construction' : design.has(key) ? 'design' : 'other');
    }
    async project(projectId) {
        const p = await this.projects.findOneBy({ id: projectId });
        if (!p)
            throw new common_1.NotFoundException('Project not found');
        return p;
    }
    async settingsFor(projectId) {
        const row = await this.pfin.findOneBy({ projectId });
        return { row, exists: !!row, value: row || { projectId, currency: 'USD', fxRate: 1, originalContractValue: 0, originalBudget: null, retentionPct: 0, taxPct: 0, paymentTermsDays: 30, requireProgressApproval: false, reportedProgress: 0, approvedProgress: 0, version: 0 } };
    }
    async context(projectId) {
        const project = await this.project(projectId);
        const [{ value: s, exists }, phaseRows, taskRows, phf, tf, invs, lineRows, pays, cat] = await Promise.all([
            this.settingsFor(projectId),
            this.phases.find({ where: { projectId } }),
            this.tasks.find({ where: { projectId } }),
            this.phfin.find({ where: { projectId } }),
            this.tfin.find({ where: { projectId } }),
            this.invoices.find({ where: { projectId, status: 'issued' } }),
            this.lines.find({ where: { projectId } }),
            this.payments.find({ where: { projectId } }),
            this.categories(project),
        ]);
        const issued = new Set(invs.map((x) => x.id));
        const lines = lineRows.filter((l) => issued.has(l.invoiceId)).map((l) => ({
            id: l.id, invoiceId: l.invoiceId, kind: l.kind, targetType: l.targetType, phaseId: l.phaseId, taskId: l.taskId,
            amountC: (0, money_1.toCents)(l.amount), retentionC: (0, money_1.toCents)(l.retentionAmount), taxC: (0, money_1.toCents)(l.taxAmount),
        }));
        const fin = (r) => r;
        return {
            settings: s, exists, phaseRows, taskRows,
            input: {
                originalContractC: (0, money_1.toCents)(s.originalContractValue), approvedChangesC: 0, requireApproval: !!s.requireProgressApproval,
                project: { contractValue: null, reportedProgress: Number(s.reportedProgress) || 0, approvedProgress: Number(s.approvedProgress) || 0, version: s.version },
                phases: phaseRows.map((p) => ({ id: p.id, key: p.key, name: p.name, order: p.order, category: cat(p.key) })),
                tasks: taskRows.filter((t) => !t.parentId).map((t) => ({ id: t.id, title: t.title, phaseId: t.phaseId || null, done: !!t.completed || t.status === 'Done', order: t.order || 0 })),
                phaseFin: new Map(phf.map((r) => [r.phaseId, fin(r)])),
                taskFin: new Map(tf.map((r) => [r.taskId, fin(r)])),
                lines, invoices: invs.map((x) => ({ id: x.id, totalC: (0, money_1.toCents)(x.total), dueDate: x.dueDate })),
                payments: pays.filter((p) => !p.voidedAt && issued.has(p.invoiceId)).map((p) => ({ invoiceId: p.invoiceId, amountC: (0, money_1.toCents)(p.amount) })),
                today: (0, workforce_util_1.todayISO)(),
            },
        };
    }
    async overview(projectId, actor) {
        const rights = await this.need(actor, 'view');
        const project = await this.project(projectId);
        const ctx = await this.context(projectId);
        const sov = (0, finance_calc_1.computeSov)(ctx.input);
        const [drafts, lead] = await Promise.all([
            this.invoices.count({ where: { projectId, status: 'draft' } }),
            project.leadId ? this.leads.findOneBy({ id: project.leadId }) : Promise.resolve(null),
        ]);
        return {
            project: { id: project.id, name: project.name, contractAmt: project.contractAmt, stage: project.stage },
            settings: { ...ctx.settings, exists: ctx.exists },
            billToDefaults: lead ? billToFromLead(lead) : null,
            suggestedContract: (0, money_1.fromCents)((0, money_1.toCents)(parseAmount(project.contractAmt))),
            sov: (0, finance_calc_1.toDollars)(sov), drafts, rights,
            looseTasks: ctx.input.tasks.filter((t) => !t.phaseId && ctx.input.taskFin.get(t.id)?.contractValue == null).map((t) => ({ id: t.id, title: t.title })),
        };
    }
    async saveSettings(projectId, dto, actor) {
        await this.need(actor, 'manage');
        const project = await this.project(projectId);
        const { row } = await this.settingsFor(projectId);
        if (row)
            assertVersion(row, dto.version);
        const patch = {};
        if (dto.originalContractValue !== undefined) {
            const v = moneyIn(dto.originalContractValue, 'The contract value') ?? 0;
            if (row?.contractLockedAt && (0, money_1.toCents)(v) !== (0, money_1.toCents)(row.originalContractValue)) {
                throw new common_1.BadRequestException('Invoices have been issued against this contract -- the original value is locked. Record a change order instead.');
            }
            patch.originalContractValue = v;
        }
        if (dto.originalBudget !== undefined)
            patch.originalBudget = moneyIn(dto.originalBudget, 'The budget');
        if (dto.retentionPct !== undefined)
            patch.retentionPct = pctIn(dto.retentionPct, 'Retention');
        if (dto.taxPct !== undefined)
            patch.taxPct = pctIn(dto.taxPct, 'Tax');
        if (dto.paymentTermsDays !== undefined) {
            const d = Number(dto.paymentTermsDays);
            if (!Number.isInteger(d) || d < 0 || d > 365)
                throw new common_1.BadRequestException('Payment terms are 0-365 days.');
            patch.paymentTermsDays = d;
        }
        if (dto.requireProgressApproval !== undefined)
            patch.requireProgressApproval = !!dto.requireProgressApproval;
        for (const k of ['billToName', 'billToEmail', 'billToAddress', 'contractNumber', 'poNumber', 'notes'])
            if (dto[k] !== undefined)
                patch[k] = String(dto[k] ?? '').trim() || null;
        if (patch.originalContractValue !== undefined) {
            const sov = (0, finance_calc_1.computeSov)((await this.context(projectId)).input);
            if (!sov.summary.lumpSum && (0, money_1.toCents)(patch.originalContractValue) < sov.summary.allocatedC) {
                throw new common_1.BadRequestException(`${fmtUsd(sov.summary.allocatedC)} is already allocated to milestones and tasks -- lower those first.`);
            }
        }
        const base = row || this.pfin.create({ ...(await this.settingsFor(projectId)).value, createdAt: now(), createdBy: actor.name });
        const changes = this.diff(base, patch);
        Object.assign(base, patch, { updatedAt: now(), updatedBy: actor.name });
        const saved = await this.pfin.save(base);
        if (patch.originalContractValue !== undefined) {
            await this.projects.update({ id: projectId }, { contractAmt: fmtUsd((0, money_1.toCents)(saved.originalContractValue)) });
        }
        await this.log(null, { projectId, entityType: 'project', entityId: String(projectId), action: row ? 'settings_changed' : 'financials_set_up', changes }, actor);
        return this.overview(project.id, actor);
    }
    async target(kind, id) {
        if (kind === 'phase') {
            const ph = await this.phases.findOneBy({ id });
            if (!ph)
                throw new common_1.NotFoundException('Milestone not found');
            return { projectId: ph.projectId, phaseId: ph.id, name: ph.name };
        }
        if (kind === 'task') {
            const t = await this.tasks.findOneBy({ id });
            if (!t || t.projectId == null)
                throw new common_1.NotFoundException('Task not found');
            if (t.parentId)
                throw new common_1.BadRequestException('Values go on tasks, not subtasks.');
            return { projectId: t.projectId, phaseId: t.phaseId || null, name: t.title };
        }
        throw new common_1.BadRequestException('Unknown item.');
    }
    finRepo(kind) { return kind === 'phase' ? this.phfin : this.tfin; }
    async finRow(kind, id) {
        return kind === 'phase' ? this.phfin.findOneBy({ phaseId: id }) : this.tfin.findOneBy({ taskId: id });
    }
    async updateItem(kind, id, dto, actor) {
        await this.need(actor, 'manage');
        const t = await this.target(kind, id);
        const row = await this.finRow(kind, id);
        if (row)
            assertVersion(row, dto.version);
        const ctx = await this.context(t.projectId);
        const sov = (0, finance_calc_1.computeSov)(ctx.input);
        const flat = sov.groups.flatMap((g) => g.rows.flatMap((r) => [r, ...(r.children || [])]));
        const me = flat.find((r) => r.kind === kind && r.id === id);
        const patch = {};
        if (dto.contractValue !== undefined) {
            const v = moneyIn(dto.contractValue, 'The value');
            const vC = v == null ? null : (0, money_1.toCents)(v);
            if (kind === 'phase' && me?.valueFromTasks && vC != null)
                throw new common_1.BadRequestException("This milestone's value comes from its tasks -- set values on the tasks instead.");
            if (kind === 'task' && t.phaseId) {
                const parent = flat.find((r) => r.kind === 'phase' && r.id === t.phaseId);
                if (parent?.billedAsWhole && vC != null)
                    throw new common_1.BadRequestException('This milestone has been invoiced as a whole -- its tasks can’t take separate values now.');
                if (parent && !parent.valueFromTasks && parent.ownValueC != null && vC != null)
                    throw new common_1.BadRequestException(`${parent.name} has its own value. Clear it before splitting it across tasks.`);
            }
            const invoicedC = me?.invoicedC || 0;
            if (vC != null && vC < invoicedC)
                throw new common_1.BadRequestException(`${fmtUsd(invoicedC)} has already been invoiced against this -- the value can't go below that.`);
            if (vC == null && invoicedC)
                throw new common_1.BadRequestException('This has been invoiced -- its value can’t be cleared.');
            const oldC = me?.ownValueC ?? 0;
            const newAllocated = sov.summary.allocatedC - oldC + (vC ?? 0);
            const revised = sov.summary.revisedContractC;
            if ((vC ?? 0) > oldC && newAllocated > revised) {
                throw new common_1.BadRequestException(`That would allocate ${fmtUsd(newAllocated)} against a ${fmtUsd(revised)} contract. Only ${fmtUsd(Math.max(revised - sov.summary.allocatedC, 0))} is unallocated.`);
            }
            patch.contractValue = v;
        }
        for (const k of ['budgetedCost', 'estimatedCost'])
            if (dto[k] !== undefined)
                patch[k] = moneyIn(dto[k], 'Cost');
        if (dto.billingMethod !== undefined) {
            if (!exports.BILLING_METHODS.includes(dto.billingMethod))
                throw new common_1.BadRequestException('Unknown billing method.');
            patch.billingMethod = dto.billingMethod;
        }
        for (const k of ['retentionPctOverride', 'taxPctOverride']) {
            if (dto[k] !== undefined)
                patch[k] = dto[k] === null || dto[k] === '' ? null : pctIn(dto[k], k.startsWith('ret') ? 'Retention' : 'Tax');
        }
        for (const k of ['csiCodeId', 'subcontractorTradeId', 'deliverables', 'requiredFromUs', 'requiredFromClient', 'requiredFromContractor', 'acceptanceCriteria', 'billingCondition', 'notes']) {
            if (dto[k] !== undefined)
                patch[k] = String(dto[k] ?? '').trim() || null;
        }
        const repo = this.finRepo(kind);
        const base = row || repo.create({
            [kind === 'phase' ? 'phaseId' : 'taskId']: id, projectId: t.projectId, ...(kind === 'task' ? { phaseId: t.phaseId } : {}),
            contractValue: null, reportedProgress: 0, approvedProgress: 0, billingMethod: 'percent_complete', createdAt: now(), createdBy: actor.name,
        });
        const changes = this.diff(base, patch);
        Object.assign(base, patch, { updatedAt: now(), updatedBy: actor.name });
        await repo.save(base);
        await this.log(null, { projectId: t.projectId, entityType: kind, entityId: id, action: row ? 'item_changed' : 'item_set_up', changes }, actor);
        return this.overview(t.projectId, actor);
    }
    async reportProgress(kind, id, dto, actor, projectIdForLump) {
        await this.need(actor, 'reportProgress');
        return this.changeProgress(kind, id, 'reported', dto, actor, projectIdForLump);
    }
    async approveProgress(kind, id, dto, actor, projectIdForLump) {
        await this.need(actor, 'manage');
        return this.changeProgress(kind, id, 'approved', dto, actor, projectIdForLump);
    }
    async changeProgress(kind, id, which, dto, actor, projectIdForLump) {
        let projectId;
        let row;
        let repo;
        if (kind === 'project') {
            projectId = Number(projectIdForLump ?? id);
            await this.project(projectId);
            const s = await this.settingsFor(projectId);
            if (!s.row)
                throw new common_1.BadRequestException('Set up this project’s financials first.');
            row = s.row;
            repo = this.pfin;
        }
        else {
            const t = await this.target(kind, id);
            projectId = t.projectId;
            if (kind === 'phase') {
                const sov = (0, finance_calc_1.computeSov)((await this.context(projectId)).input);
                const me = sov.groups.flatMap((g) => g.rows).find((r) => r.id === id);
                if (me?.valueFromTasks)
                    throw new common_1.BadRequestException("This milestone's progress comes from its tasks -- update them instead.");
            }
            repo = this.finRepo(kind);
            row = await this.finRow(kind, id);
            if (!row) {
                row = repo.create({ [kind === 'phase' ? 'phaseId' : 'taskId']: id, projectId, ...(kind === 'task' ? { phaseId: t.phaseId } : {}), contractValue: null, reportedProgress: 0, approvedProgress: 0, billingMethod: 'percent_complete', createdAt: now(), createdBy: actor.name });
                row.version = undefined;
            }
        }
        if (row.version)
            assertVersion(row, dto.version);
        const reported = Number(row.reportedProgress) || 0;
        const approved = Number(row.approvedProgress) || 0;
        const from = which === 'reported' ? reported : approved;
        const to = pctIn(dto.pct ?? (which === 'approved' ? reported : undefined), which === 'reported' ? 'Progress' : 'Approved progress');
        if (to < from && !dto.reason?.trim())
            throw new common_1.BadRequestException('Say why progress is going down.');
        if (which === 'approved' && to > reported)
            throw new common_1.BadRequestException(`Approved progress can't be above the reported ${reported}%.`);
        const at = now();
        const updates = [{ kind: which, fromPct: from, toPct: to }];
        if (which === 'reported') {
            row.reportedProgress = to;
            if (approved > to) {
                row.approvedProgress = to;
                updates.push({ kind: 'approved', fromPct: approved, toPct: to });
            }
        }
        else {
            row.approvedProgress = to;
            if (kind !== 'project')
                Object.assign(row, { progressApprovedBy: actor.name, progressApprovedAt: at });
        }
        Object.assign(row, { updatedAt: at, updatedBy: actor.name });
        await repo.save(row);
        for (const u of updates) {
            await this.progress.save(this.progress.create({ id: (0, workforce_util_1.newId)('PU'), projectId, targetType: kind, targetId: kind === 'project' ? String(projectId) : id, ...u, reason: dto.reason?.trim() || undefined, byName: actor.name, byId: actor.id, at }));
            await this.log(null, { projectId, entityType: kind, entityId: kind === 'project' ? String(projectId) : id, action: `progress_${u.kind}`, changes: { progress: { from: u.fromPct, to: u.toPct } }, reason: dto.reason?.trim() }, actor);
        }
        return this.overview(projectId, actor);
    }
    async progressHistory(kind, id, actor) {
        await this.need(actor, 'view');
        return (await this.progress.find({ where: { targetType: kind, targetId: id } })).sort((a, b) => b.at.localeCompare(a.at));
    }
    async addMilestone(projectId, dto, actor) {
        await this.need(actor, 'manage');
        await this.project(projectId);
        const name = String(dto.name || '').trim();
        if (!name)
            throw new common_1.BadRequestException('Name the milestone.');
        const existing = await this.phases.find({ where: { projectId } });
        const key = 'fin-' + Date.now().toString(36);
        const phase = await this.phases.save(this.phases.create({
            id: `PH-${projectId}-${key}`, projectId, key, name, color: '#7E9B93', order: existing.reduce((m, p) => Math.max(m, p.order), -1) + 1,
        }));
        await this.log(null, { projectId, entityType: 'phase', entityId: phase.id, action: 'milestone_added', changes: { name: { from: null, to: name } } }, actor);
        if (dto.contractValue != null && dto.contractValue !== '')
            return this.updateItem('phase', phase.id, { contractValue: dto.contractValue }, actor);
        return this.overview(projectId, actor);
    }
    async itemInvoices(kind, id, actor) {
        await this.need(actor, 'view');
        let rows;
        if (kind === 'project')
            rows = await this.lines.find({ where: { projectId: Number(id), targetType: 'project' } });
        else if (kind === 'task')
            rows = await this.lines.find({ where: { taskId: id } });
        else {
            const ph = await this.phases.findOneBy({ id });
            const taskIds = ph ? new Set((await this.tasks.find({ where: { phaseId: id } })).map((t) => t.id)) : new Set();
            rows = (await this.lines.find({ where: { projectId: ph?.projectId ?? -1 } })).filter((l) => l.phaseId === id || (l.taskId && taskIds.has(l.taskId)));
        }
        const invs = new Map((await this.invoices.find({ where: { projectId: rows[0]?.projectId ?? -1 } })).map((x) => [x.id, x]));
        return rows.filter((l) => invs.has(l.invoiceId)).map((l) => {
            const inv = invs.get(l.invoiceId);
            return {
                invoiceId: inv.id, number: inv.issuedNumber, status: inv.status, invoiceDate: inv.invoiceDate, description: l.description,
                amount: l.amount, retention: l.retentionAmount, net: (0, money_1.fromCents)((0, finance_calc_1.lineMath)({ kind: l.kind, amountC: (0, money_1.toCents)(l.amount), retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, taxable: l.taxable, taxPct: l.taxPct }).netC),
                prevProgressPct: l.prevProgressPct, currentProgressPct: l.currentProgressPct,
            };
        }).sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate));
    }
    async brand(actor) {
        await this.need(actor, 'view');
        const keys = ['companyName', 'tagline', 'logoDataUrl', 'accentColor', 'address', 'phone', 'email', 'website', 'footerNote'].map((k) => `brand.${k}`);
        const b = (0, letterhead_1.brandingFrom)(await this.settings.getMany(keys));
        return { companyName: b.companyName, tagline: b.tagline, logoDataUrl: b.logoDataUrl, accentColor: b.accentColor, address: b.address, phone: b.phone, email: b.email, website: b.website, footerNote: b.footerNote };
    }
    async activity(projectId, actor) {
        await this.need(actor, 'view');
        return (await this.activityRepo.find({ where: { projectId } })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300);
    }
};
exports.FinancialsService = FinancialsService;
exports.FinancialsService = FinancialsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.LeadEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.ProjectPhaseEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.ProjectTaskEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.ProjectFinancialEntity)),
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.PhaseFinancialEntity)),
    __param(6, (0, typeorm_1.InjectRepository)(entities_1.TaskFinancialEntity)),
    __param(7, (0, typeorm_1.InjectRepository)(entities_1.ProgressUpdateEntity)),
    __param(8, (0, typeorm_1.InjectRepository)(entities_1.ProjectInvoiceEntity)),
    __param(9, (0, typeorm_1.InjectRepository)(entities_1.ProjectInvoiceLineEntity)),
    __param(10, (0, typeorm_1.InjectRepository)(entities_1.ProjectPaymentEntity)),
    __param(11, (0, typeorm_1.InjectRepository)(entities_1.FinanceActivityEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        settings_service_1.SettingsService,
        manpower_access_service_1.ManpowerAccess])
], FinancialsService);
function parseAmount(s) {
    if (!s)
        return 0;
    const m = String(s).replace(/[, $]/g, '').match(/^(\d+(?:\.\d+)?)([kKmM])?/);
    if (!m)
        return 0;
    const n = Number(m[1]) * (m[2] ? (m[2].toLowerCase() === 'm' ? 1e6 : 1e3) : 1);
    return Number.isFinite(n) ? n : 0;
}
function billToFromLead(lead) {
    const addrs = (lead.addresses || {});
    const a = addrs.billing || addrs.businessMailing || null;
    const line = a && typeof a === 'object' ? [a.street || a.line1 || a.address, a.address2 || a.line2, [a.city, a.state].filter(Boolean).join(', '), a.zip || a.zipCode || a.postalCode].filter(Boolean).join('\n') : '';
    return { name: lead.businessName || lead.leadName, email: lead.email || '', address: line };
}
//# sourceMappingURL=financials.service.js.map