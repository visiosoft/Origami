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
exports.RetentionService = exports.RELEASE_REASONS = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const workforce_util_1 = require("../manpower/workforce.util");
const finance_calc_1 = require("./finance.calc");
const financials_service_1 = require("./financials.service");
const invoices_service_1 = require("./invoices.service");
const money_1 = require("./money");
exports.RELEASE_REASONS = ['substantial_completion', 'final_completion', 'milestone_accepted', 'partial', 'other'];
const OPEN = ['requested', 'approved'];
const now = () => new Date().toISOString();
const fmtUsd = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let RetentionService = class RetentionService {
    constructor(repo, fin, invoices) {
        this.repo = repo;
        this.fin = fin;
        this.invoices = invoices;
    }
    async load(id) {
        const r = await this.repo.findOneBy({ id });
        if (!r)
            throw new common_1.NotFoundException('Retention release not found');
        return r;
    }
    async held(projectId) {
        const sov = (0, finance_calc_1.computeSov)((await this.fin.context(projectId)).input);
        const items = (0, invoices_service_1.billableItems)(sov).filter((r) => r.retentionC > 0);
        const flat = sov.groups.flatMap((g) => g.rows.flatMap((r) => [r, ...(r.children || [])]));
        return { sov, items, flat, totalC: sov.summary.retentionHeldC };
    }
    scopeHeldC(h, scope, targetId) {
        if (scope === 'project')
            return h.totalC;
        const row = scope === 'phase' ? h.flat.find((r) => r.kind === 'phase' && r.id === targetId) : h.flat.find((r) => r.kind === 'task' && r.id === targetId);
        if (!row)
            throw new common_1.BadRequestException(`That ${scope === 'phase' ? 'milestone' : 'task'} isn’t on this project.`);
        return row.retentionC;
    }
    async overview(projectId, actor) {
        const rights = await this.fin.need(actor, 'view');
        const [h, releases] = await Promise.all([this.held(projectId), this.repo.find({ where: { projectId } })]);
        const openC = (0, money_1.sumCents)(releases.filter((r) => OPEN.includes(r.status)).map((r) => (0, money_1.toCents)(r.amount)));
        const s = h.sov.summary;
        const rows = h.flat.filter((r) => r.retentionC > 0 || (r.retentionReleasedC || 0) > 0).map((r) => ({
            kind: r.kind, id: r.id, name: r.name, phaseId: r.phaseId || null, ...(0, finance_calc_1.toDollars)({ heldC: r.retentionC, releasedC: r.retentionReleasedC || 0, accruedC: r.retentionC + (r.retentionReleasedC || 0) }),
        }));
        if (h.sov.lump && (h.sov.lump.retentionC || h.sov.lump.retentionReleasedC)) {
            const l = h.sov.lump;
            rows.unshift({ kind: 'project', id: String(projectId), name: l.name, phaseId: null, ...(0, finance_calc_1.toDollars)({ heldC: l.retentionC, releasedC: l.retentionReleasedC || 0, accruedC: l.retentionC + (l.retentionReleasedC || 0) }) });
        }
        return {
            ...(0, finance_calc_1.toDollars)({ accruedC: s.retentionAccruedC, releasedC: s.retentionReleasedC, heldC: s.retentionHeldC, openC, availableC: Math.max(s.retentionHeldC - openC, 0) }),
            items: rows,
            releases: releases.sort((a, b) => b.number.localeCompare(a.number)),
            canRelease: rights.releaseRetention, canRequest: rights.prepareInvoice || rights.releaseRetention,
        };
    }
    async request(projectId, dto, actor) {
        const rights = await this.fin.rights(actor);
        if (!rights.prepareInvoice && !rights.releaseRetention)
            throw new common_1.BadRequestException("Your role doesn't allow requesting retention releases.");
        await this.fin.project(projectId);
        const scope = ['project', 'phase', 'task'].includes(dto.scope || '') ? dto.scope : 'project';
        const targetId = scope === 'project' ? null : String(dto.targetId || '');
        const h = await this.held(projectId);
        const releases = await this.repo.find({ where: { projectId } });
        const open = releases.filter((r) => OPEN.includes(r.status));
        const amountC = dto.amount == null || dto.amount === '' ? null : (0, money_1.toCents)(dto.amount);
        const scopeHeld = this.scopeHeldC(h, scope, targetId);
        const scopeOpen = (0, money_1.sumCents)(open.filter((r) => r.scope === scope && (r.targetId || null) === targetId).map((r) => (0, money_1.toCents)(r.amount)));
        const projectAvail = h.totalC - (0, money_1.sumCents)(open.map((r) => (0, money_1.toCents)(r.amount)));
        const availC = Math.min(scopeHeld - scopeOpen, projectAvail);
        const want = amountC ?? availC;
        if (want <= 0)
            throw new common_1.BadRequestException(availC <= 0 ? 'No retention is held there that isn’t already being released.' : 'The release must be more than zero.');
        if (want > availC)
            throw new common_1.BadRequestException(`Only ${fmtUsd(availC)} of retention is available to release there.`);
        const reason = exports.RELEASE_REASONS.includes(dto.reason || '') ? dto.reason : 'substantial_completion';
        let saved = null;
        for (let attempt = 0; attempt < 3 && !saved; attempt++) {
            try {
                saved = await this.repo.save(this.repo.create({
                    id: (0, workforce_util_1.newId)('RR'), projectId, number: await this.fin.nextProjectNumber(this.repo, projectId, 'RR'), scope, targetId: targetId || undefined,
                    amount: (0, money_1.fromCents)(want), reason, notes: dto.notes?.trim() || undefined, status: 'requested', requestedBy: actor.name, createdAt: now(), createdBy: actor.name,
                }));
            }
            catch (e) {
                if (attempt === 2)
                    throw e;
            }
        }
        await this.fin.approval(null, { projectId, entityType: 'retention_release', entityId: saved.id, decision: 'requested', amount: saved.amount, comment: dto.notes }, actor);
        await this.fin.log(null, { projectId, entityType: 'retention_release', entityId: saved.id, action: 'retention_release_requested', changes: { amount: { from: null, to: saved.amount } } }, actor);
        return this.overview(projectId, actor);
    }
    async decide(id, dto, actor) {
        const r = await this.load(id);
        (0, financials_service_1.assertVersion)(r, dto.version);
        const at = now();
        if (dto.decision === 'cancel') {
            const rights = await this.fin.rights(actor);
            if (!rights.prepareInvoice && !rights.releaseRetention)
                throw new common_1.BadRequestException("Your role doesn't allow cancelling retention releases.");
            if (!OPEN.includes(r.status))
                throw new common_1.BadRequestException(`This release is ${r.status}.`);
            if (r.invoiceId)
                throw new common_1.BadRequestException('It’s on a draft invoice -- remove it from the draft (or delete the draft) first.');
            Object.assign(r, { status: 'cancelled', closedReason: dto.reason?.trim() || null });
        }
        else {
            await this.fin.need(actor, 'releaseRetention');
            if (r.status !== 'requested')
                throw new common_1.BadRequestException(`This release is ${r.status}.`);
            if (dto.decision === 'approve') {
                const h = await this.held(r.projectId);
                const scopeHeld = this.scopeHeldC(h, r.scope, r.targetId);
                if ((0, money_1.toCents)(r.amount) > scopeHeld)
                    throw new common_1.BadRequestException(`Only ${fmtUsd(scopeHeld)} is held there now -- reject this and request the right amount.`);
                Object.assign(r, { status: 'approved', approvedAt: at, approvedBy: actor.name });
            }
            else {
                if (!dto.reason?.trim())
                    throw new common_1.BadRequestException('Say why it’s rejected.');
                Object.assign(r, { status: 'rejected', rejectedAt: at, rejectedBy: actor.name, closedReason: dto.reason.trim() });
            }
        }
        Object.assign(r, { updatedAt: at, updatedBy: actor.name });
        await this.repo.save(r);
        const decision = dto.decision === 'approve' ? 'approved' : dto.decision === 'reject' ? 'rejected' : 'cancelled';
        await this.fin.approval(null, { projectId: r.projectId, entityType: 'retention_release', entityId: id, decision, comment: dto.reason, amount: r.amount }, actor);
        await this.fin.log(null, { projectId: r.projectId, entityType: 'retention_release', entityId: id, action: `retention_release_${decision}`, reason: dto.reason?.trim() }, actor);
        return this.overview(r.projectId, actor);
    }
    async bill(id, actor) {
        await this.fin.need(actor, 'prepareInvoice');
        const r = await this.load(id);
        if (r.status !== 'approved')
            throw new common_1.BadRequestException('Only an approved release can be billed.');
        if (r.invoiceId)
            return this.invoices.get(r.invoiceId, actor);
        const h = await this.held(r.projectId);
        let pool;
        if (r.scope === 'project')
            pool = h.items;
        else if (r.scope === 'task')
            pool = h.items.filter((x) => x.kind === 'task' && x.id === r.targetId);
        else {
            const phase = h.flat.find((x) => x.kind === 'phase' && x.id === r.targetId);
            pool = h.items.filter((x) => (x.kind === 'phase' && x.id === r.targetId) || (x.kind === 'task' && phase && x.phaseId === phase.id));
        }
        const amountC = (0, money_1.toCents)(r.amount);
        const heldC = (0, money_1.sumCents)(pool.map((x) => x.retentionC));
        if (amountC > heldC)
            throw new common_1.BadRequestException(`Only ${fmtUsd(heldC)} is held there now.`);
        const shares = (0, money_1.allocate)(amountC, pool.map((x) => x.retentionC));
        const lines = pool.map((x, i) => ({ item: x, amountC: shares[i] })).filter((l) => l.amountC > 0);
        return this.invoices.createReleaseDraft(r, lines.map((l) => ({
            kind: 'retention_release', retentionReleaseId: r.id, targetType: l.item.kind, phaseId: l.item.kind === 'phase' ? l.item.id : l.item.phaseId || null,
            taskId: l.item.kind === 'task' ? l.item.id : null, amount: (0, money_1.fromCents)(l.amountC), description: `Retention released (${r.number}) — ${l.item.name}`,
        })), actor);
    }
};
exports.RetentionService = RetentionService;
exports.RetentionService = RetentionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.RetentionReleaseEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        financials_service_1.FinancialsService,
        invoices_service_1.InvoicesService])
], RetentionService);
//# sourceMappingURL=retention.service.js.map