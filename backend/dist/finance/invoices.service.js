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
exports.InvoicesService = exports.reimbursableBillC = exports.itemKey = exports.PAYMENT_METHODS = void 0;
exports.billableItems = billableItems;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const attachments_service_1 = require("../google/attachments.service");
const task_types_1 = require("../database/task.types");
const workforce_util_1 = require("../manpower/workforce.util");
const finance_calc_1 = require("./finance.calc");
const financials_service_1 = require("./financials.service");
const money_1 = require("./money");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const LINE_KINDS = ['progress', 'manual', 'adjustment', 'reimbursable', 'retention_release'];
exports.PAYMENT_METHODS = ['ach', 'check', 'wire', 'card', 'cash', 'other'];
const now = () => new Date().toISOString();
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const fmtUsd = (c) => (c < 0 ? '-$' : '$') + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function billableItems(sov) {
    const out = [];
    if (sov.lump)
        out.push(sov.lump);
    for (const g of sov.groups)
        for (const r of g.rows) {
            if (r.kind === 'phase') {
                if (r.valueFromTasks)
                    out.push(...(r.children || []).filter((c) => c.valueC != null));
                else if (r.valueC != null)
                    out.push(r);
            }
            else
                out.push(r);
        }
    return out;
}
const itemKey = (x) => x.targetType === 'project' || x.kind === 'project' ? 'project' : x.taskId ? `task:${x.taskId}` : x.phaseId ? `phase:${x.phaseId}` : (x.kind === 'task' ? `task:${x.id}` : `phase:${x.id}`);
exports.itemKey = itemKey;
const reimbursableBillC = (r) => (0, money_1.toCents)(r.cost) + (0, money_1.pctOf)((0, money_1.toCents)(r.cost), Number(r.markupPct) || 0);
exports.reimbursableBillC = reimbursableBillC;
let InvoicesService = class InvoicesService {
    constructor(invoices, lines, payments, pfin, fin, reimbs, releases, attachments) {
        this.invoices = invoices;
        this.lines = lines;
        this.payments = payments;
        this.pfin = pfin;
        this.fin = fin;
        this.reimbs = reimbs;
        this.releases = releases;
        this.attachments = attachments;
    }
    async load(id) {
        const inv = await this.invoices.findOneBy({ id });
        if (!inv)
            throw new common_1.NotFoundException('Invoice not found');
        return inv;
    }
    totalsOf(lines) {
        return (0, finance_calc_1.invoiceTotals)(lines.map((l) => ({ kind: l.kind, amountC: (0, money_1.toCents)(l.amount), retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, taxable: l.taxable, taxPct: l.taxPct })));
    }
    present(inv, lines, pays, credits = []) {
        const live = this.totalsOf(lines);
        const t = inv.status === 'draft' ? live : {
            ...live, contractWorkC: (0, money_1.toCents)(inv.contractWork), retentionC: (0, money_1.toCents)(inv.retentionAmount), adjustmentC: (0, money_1.toCents)(inv.adjustmentTotal), taxC: (0, money_1.toCents)(inv.taxAmount), totalC: (0, money_1.toCents)(inv.total),
        };
        const isCredit = inv.kind === 'credit';
        const creditedC = !isCredit && inv.status === 'issued' ? (0, money_1.sumCents)(credits.filter((c) => c.status === 'issued').map((c) => (0, money_1.toCents)(c.total))) : 0;
        const paidC = !isCredit && inv.status === 'issued' ? (0, money_1.sumCents)(pays.filter((p) => !p.voidedAt).map((p) => (0, money_1.toCents)(p.amount))) : 0;
        const outstandingC = !isCredit && inv.status === 'issued' ? t.totalC + creditedC - paidC : 0;
        const overdue = outstandingC > 0 && !!inv.dueDate && inv.dueDate < (0, workforce_util_1.todayISO)();
        const paymentStatus = inv.status === 'draft' ? 'draft' : inv.status === 'void' ? 'void' : isCredit ? 'credit'
            : outstandingC < 0 ? 'credit_balance' : outstandingC === 0 ? 'paid' : overdue ? 'overdue' : paidC > 0 || creditedC ? 'partially_paid' : 'unpaid';
        return {
            ...inv, ...(0, finance_calc_1.toDollars)({ ...t, paidC, creditedC, outstandingC }), paymentStatus, overdue, attachments: (0, task_types_1.normalizeAttachments)(inv.attachments),
            credits: credits.map((c) => ({ id: c.id, issuedNumber: c.issuedNumber, status: c.status, creditType: c.creditType, total: c.total, invoiceDate: c.invoiceDate })),
        };
    }
    async list(projectId, actor) {
        await this.fin.need(actor, 'view');
        const [invs, lines, pays] = await Promise.all([
            this.invoices.find({ where: { projectId } }), this.lines.find({ where: { projectId } }), this.payments.find({ where: { projectId } }),
        ]);
        return invs.map((inv) => this.present(inv, lines.filter((l) => l.invoiceId === inv.id), pays.filter((p) => p.invoiceId === inv.id), invs.filter((c) => c.creditForInvoiceId === inv.id)))
            .sort((a, b) => (b.invoiceDate || '').localeCompare(a.invoiceDate || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
    async get(id, actor) {
        await this.fin.need(actor, 'view');
        const inv = await this.load(id);
        const [lines, pays, credits, forInv] = await Promise.all([
            this.lines.find({ where: { invoiceId: id } }), this.payments.find({ where: { invoiceId: id } }),
            this.invoices.find({ where: { creditForInvoiceId: id } }),
            inv.creditForInvoiceId ? this.invoices.findOneBy({ id: inv.creditForInvoiceId }) : Promise.resolve(null),
        ]);
        const sorted = lines.sort((a, b) => a.lineOrder - b.lineOrder);
        return {
            ...this.present(inv, sorted, pays, credits),
            lines: sorted.map((l) => ({ ...l, ...(0, finance_calc_1.toDollars)((0, finance_calc_1.lineMath)({ kind: l.kind, amountC: (0, money_1.toCents)(l.amount), retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, taxable: l.taxable, taxPct: l.taxPct })) })),
            payments: pays.sort((a, b) => a.date.localeCompare(b.date)),
            creditFor: forInv ? { id: forInv.id, issuedNumber: forInv.issuedNumber } : null,
            approvals: await this.fin.approvalsFor(id),
        };
    }
    async projectPayments(projectId, actor) {
        await this.fin.need(actor, 'view');
        const [pays, invs] = await Promise.all([this.payments.find({ where: { projectId } }), this.invoices.find({ where: { projectId } })]);
        const num = new Map(invs.map((i) => [i.id, i.issuedNumber]));
        return pays.map((p) => ({ ...p, invoiceNumber: num.get(p.invoiceId) })).sort((a, b) => b.date.localeCompare(a.date));
    }
    async refs(projectId, m) {
        const [r, rr] = await Promise.all([
            (m ? m.getRepository(entities_1.ReimbursableEntity) : this.reimbs).find({ where: { projectId } }),
            (m ? m.getRepository(entities_1.RetentionReleaseEntity) : this.releases).find({ where: { projectId } }),
        ]);
        return { reimbs: new Map(r.map((x) => [x.id, x])), releases: new Map(rr.map((x) => [x.id, x])) };
    }
    async createDraft(projectId, dto, actor) {
        await this.fin.need(actor, 'prepareInvoice');
        const { row: s } = await this.fin.settingsFor(projectId);
        if (!s)
            throw new common_1.BadRequestException('Set up this project’s financials (contract value, retention, tax) before invoicing.');
        const ctx = await this.fin.context(projectId);
        const sov = (0, finance_calc_1.computeSov)(ctx.input);
        const items = billableItems(sov);
        const refs = await this.refs(projectId);
        const standard = dto.kind === 'standard';
        const wanted = standard ? [] : (dto.billReady || !dto.items?.length
            ? (dto.items?.length || !dto.reimbursableIds?.length ? items : [])
            : items.filter((r) => dto.items.some((x) => (0, exports.itemKey)({ kind: x.kind, id: x.id }) === (0, exports.itemKey)({ kind: r.kind, id: r.id })))).filter((r) => r.billableC > 0);
        const readyReimbs = Array.from(refs.reimbs.values()).filter((r) => r.status === 'approved' && r.billable && !r.invoiceId);
        const reimbs = dto.reimbursableIds?.length ? readyReimbs.filter((r) => dto.reimbursableIds.includes(r.id)) : dto.billReady ? readyReimbs : [];
        if (!standard && !wanted.length && !reimbs.length) {
            throw new common_1.BadRequestException('Nothing is ready to invoice: no item has earned more than has been billed, and no approved reimbursable is waiting. Update progress first, or start a standard invoice for manual items.');
        }
        const today = (0, workforce_util_1.todayISO)();
        const inv = this.invoices.create({
            id: (0, workforce_util_1.newId)('PI'), projectId, kind: standard ? 'standard' : 'progress', status: 'draft', invoiceDate: today,
            dueDate: addDays(today, s.paymentTermsDays ?? 30), currency: s.currency || 'USD', fxRate: 1, baseCurrency: 'USD',
            reference: s.contractNumber, poNumber: s.poNumber, description: dto.description, billToName: s.billToName, billToEmail: s.billToEmail, billToAddress: s.billToAddress,
            retentionPct: s.retentionPct, taxPct: s.taxPct, attachments: [], createdAt: now(), createdBy: actor.name,
        });
        const lineDtos = [
            ...wanted.map((r) => ({
                kind: 'progress', targetType: r.kind, phaseId: r.kind === 'phase' ? r.id : r.kind === 'task' ? r.phaseId : null, taskId: r.kind === 'task' ? r.id : null,
                description: r.name, amount: (0, money_1.fromCents)(r.billableC),
            })),
            ...reimbs.map((r) => ({ kind: 'reimbursable', reimbursableId: r.id })),
        ];
        const built = this.buildLines(inv, lineDtos, sov, refs);
        await this.invoices.manager.transaction(async (m) => {
            await m.getRepository(entities_1.ProjectInvoiceEntity).save(inv);
            if (built.length)
                await m.getRepository(entities_1.ProjectInvoiceLineEntity).save(built, { chunk: 40 });
        });
        await this.fin.log(null, { projectId, entityType: 'invoice', entityId: inv.id, action: 'invoice_drafted', changes: { lines: { from: null, to: built.length } } }, actor);
        return this.get(inv.id, actor);
    }
    buildLines(inv, dtos, sov, refs) {
        const items = new Map(billableItems(sov).map((r) => [(0, exports.itemKey)({ kind: r.kind, id: r.id }), r]));
        const claimed = new Map();
        const released = new Map();
        const perRelease = new Map();
        const reimbSeen = new Set();
        return dtos.map((d, i) => {
            if (!LINE_KINDS.includes(d.kind))
                throw new common_1.BadRequestException('Unknown line type.');
            const base = {
                id: d.id && d.id.startsWith('PL') ? d.id : (0, workforce_util_1.newId)('PL'), invoiceId: inv.id, projectId: inv.projectId, kind: d.kind, lineOrder: i,
                description: String(d.description || '').trim(), unit: d.unit || undefined,
            };
            let amountC;
            let retPct = Number(inv.retentionPct) || 0;
            let taxPct = Number(inv.taxPct) || 0;
            let taxableDefault = taxPct > 0;
            let retentionApplies = d.retentionApplies ?? true;
            if (d.kind === 'progress') {
                const key = (0, exports.itemKey)({ targetType: d.targetType, kind: d.targetType || undefined, phaseId: d.phaseId, taskId: d.taskId });
                const item = items.get(key);
                if (!item || !item.valueC)
                    throw new common_1.BadRequestException(`Line ${i + 1}: that item has no value to bill against.`);
                const prevC = item.invoicedC;
                amountC = d.currentProgressPct != null && d.currentProgressPct !== ''
                    ? (0, money_1.pctOf)(item.valueC, (0, money_1.roundPct)(Number(d.currentProgressPct))) - prevC
                    : (0, money_1.toCents)(d.amount);
                const already = claimed.get(key) || 0;
                if (amountC <= 0)
                    throw new common_1.BadRequestException(`Line ${i + 1}: the claim must be more than zero.`);
                if (prevC + already + amountC > item.valueC) {
                    throw new common_1.BadRequestException(`Line ${i + 1} (${item.name}): only ${fmtUsd(item.valueC - prevC - already)} is left to invoice on it.`);
                }
                claimed.set(key, already + amountC);
                retPct = item.fin?.retentionPctOverride != null ? Number(item.fin.retentionPctOverride) : retPct;
                taxPct = item.fin?.taxPctOverride != null ? Number(item.fin.taxPctOverride) : taxPct;
                taxableDefault = taxPct > 0;
                Object.assign(base, {
                    targetType: item.kind, phaseId: item.kind === 'phase' ? item.id : item.kind === 'task' ? item.phaseId || null : null, taskId: item.kind === 'task' ? item.id : null,
                    description: base.description || item.name, billingMethod: item.fin?.billingMethod || 'percent_complete',
                    contractValue: (0, money_1.fromCents)(item.valueC), prevBilled: (0, money_1.fromCents)(prevC + already),
                    prevProgressPct: (0, money_1.roundPct)(((prevC + already) / item.valueC) * 100), currentProgressPct: (0, money_1.roundPct)(((prevC + already + amountC) / item.valueC) * 100),
                });
            }
            else if (d.kind === 'manual') {
                const q = d.quantity == null || d.quantity === '' ? null : Number(d.quantity);
                const rate = d.rate == null || d.rate === '' ? null : Number(d.rate);
                amountC = q != null && rate != null ? Math.round(q * (0, money_1.toCents)(rate)) : (0, money_1.toCents)(d.amount);
                if (!base.description)
                    throw new common_1.BadRequestException(`Line ${i + 1}: describe the item.`);
                if (amountC <= 0)
                    throw new common_1.BadRequestException(`Line ${i + 1}: the amount must be more than zero.`);
                Object.assign(base, { quantity: q, rate: rate == null ? null : (0, money_1.fromCents)((0, money_1.toCents)(rate)), billingMethod: 'manual' });
            }
            else if (d.kind === 'reimbursable') {
                const r = d.reimbursableId ? refs.reimbs.get(d.reimbursableId) : undefined;
                if (!r || r.projectId !== inv.projectId)
                    throw new common_1.BadRequestException(`Line ${i + 1}: that reimbursable isn't on this project.`);
                if (!r.billable)
                    throw new common_1.BadRequestException(`Line ${i + 1}: ${r.number} is marked not billable.`);
                if (r.status !== 'approved' || (r.invoiceId && r.invoiceId !== inv.id)) {
                    throw new common_1.BadRequestException(`Line ${i + 1}: ${r.number} is ${r.status === 'billed' ? 'already billed' : 'not approved yet'}.`);
                }
                if (reimbSeen.has(r.id))
                    throw new common_1.BadRequestException(`${r.number} is on this invoice twice.`);
                reimbSeen.add(r.id);
                amountC = (0, exports.reimbursableBillC)(r);
                retentionApplies = false;
                taxableDefault = !!r.taxable;
                const markup = Number(r.markupPct) || 0;
                Object.assign(base, {
                    reimbursableId: r.id, billingMethod: 'reimbursable', quantity: null, rate: null,
                    description: base.description || `${r.number} ${r.description}${markup ? ` (cost ${fmtUsd((0, money_1.toCents)(r.cost))} + ${markup}% markup)` : ''}`,
                });
            }
            else if (d.kind === 'retention_release') {
                const rel = d.retentionReleaseId ? refs.releases.get(d.retentionReleaseId) : undefined;
                if (!rel || rel.projectId !== inv.projectId)
                    throw new common_1.BadRequestException(`Line ${i + 1}: that retention release isn't on this project.`);
                if (rel.status !== 'approved' || rel.invoiceId !== inv.id)
                    throw new common_1.BadRequestException(`Line ${i + 1}: ${rel.number} isn't an approved release billed on this invoice.`);
                const key = (0, exports.itemKey)({ targetType: d.targetType, kind: d.targetType || undefined, phaseId: d.phaseId, taskId: d.taskId });
                const item = items.get(key);
                if (!item)
                    throw new common_1.BadRequestException(`Line ${i + 1}: that item holds no retention.`);
                amountC = (0, money_1.toCents)(d.amount);
                if (amountC <= 0)
                    throw new common_1.BadRequestException(`Line ${i + 1}: the release must be more than zero.`);
                const already = released.get(key) || 0;
                if (already + amountC > item.retentionC)
                    throw new common_1.BadRequestException(`Line ${i + 1} (${item.name}): only ${fmtUsd(item.retentionC - already)} of retention is held on it.`);
                released.set(key, already + amountC);
                const relSoFar = (perRelease.get(rel.id) || 0) + amountC;
                if (relSoFar > (0, money_1.toCents)(rel.amount))
                    throw new common_1.BadRequestException(`${rel.number} releases ${fmtUsd((0, money_1.toCents)(rel.amount))} -- the lines add up to more.`);
                perRelease.set(rel.id, relSoFar);
                retentionApplies = false;
                Object.assign(base, {
                    retentionReleaseId: rel.id, targetType: item.kind, phaseId: item.kind === 'phase' ? item.id : item.kind === 'task' ? item.phaseId || null : null,
                    taskId: item.kind === 'task' ? item.id : null, billingMethod: 'retention', description: base.description || `Retention released — ${item.name}`,
                });
            }
            else {
                amountC = (0, money_1.toCents)(d.amount);
                if (!base.description)
                    throw new common_1.BadRequestException(`Line ${i + 1}: say what the adjustment is for.`);
                if (!amountC)
                    throw new common_1.BadRequestException(`Line ${i + 1}: an adjustment needs an amount (negative for a discount).`);
                retentionApplies = false;
                taxableDefault = false;
            }
            if (!(0, finance_calc_1.isContractWork)(d.kind))
                retentionApplies = false;
            const taxable = d.taxable ?? taxableDefault;
            const m = (0, finance_calc_1.lineMath)({ kind: d.kind, amountC, retentionApplies, retentionPct: retPct, taxable, taxPct });
            return this.lines.create({
                ...base, amount: (0, money_1.fromCents)(amountC), retentionApplies, retentionPct: retentionApplies ? retPct : 0,
                retentionAmount: (0, money_1.fromCents)(m.retentionC), taxable, taxPct: taxable ? taxPct : 0, taxAmount: (0, money_1.fromCents)(m.taxC),
            });
        });
    }
    async createReleaseDraft(rel, dtos, actor) {
        await this.fin.need(actor, 'prepareInvoice');
        const { row: s } = await this.fin.settingsFor(rel.projectId);
        if (!s)
            throw new common_1.BadRequestException('Set up this project’s financials first.');
        if (!dtos.length)
            throw new common_1.BadRequestException('No retention is held there now.');
        const today = (0, workforce_util_1.todayISO)();
        const inv = this.invoices.create({
            id: (0, workforce_util_1.newId)('PI'), projectId: rel.projectId, kind: 'retention', status: 'draft', invoiceDate: today, dueDate: addDays(today, s.paymentTermsDays ?? 30),
            currency: s.currency || 'USD', fxRate: 1, baseCurrency: 'USD', reference: s.contractNumber, poNumber: s.poNumber, description: `Retention release ${rel.number}`,
            billToName: s.billToName, billToEmail: s.billToEmail, billToAddress: s.billToAddress, retentionPct: s.retentionPct, taxPct: s.taxPct, attachments: [],
            createdAt: now(), createdBy: actor.name,
        });
        const refs = await this.refs(rel.projectId);
        const mine = refs.releases.get(rel.id);
        if (!mine || mine.invoiceId)
            throw new common_1.BadRequestException('This release is already on an invoice.');
        mine.invoiceId = inv.id;
        const built = this.buildLines(inv, dtos, (0, finance_calc_1.computeSov)((await this.fin.context(rel.projectId)).input), refs);
        await this.invoices.manager.transaction(async (m) => {
            await m.getRepository(entities_1.ProjectInvoiceEntity).save(inv);
            await m.getRepository(entities_1.ProjectInvoiceLineEntity).save(built, { chunk: 40 });
            await m.getRepository(entities_1.RetentionReleaseEntity).update({ id: rel.id }, { invoiceId: inv.id, updatedAt: now(), updatedBy: actor.name });
        });
        await this.fin.log(null, { projectId: rel.projectId, entityType: 'invoice', entityId: inv.id, action: 'invoice_drafted', changes: { release: { from: null, to: rel.number } } }, actor);
        return this.get(inv.id, actor);
    }
    asDtos(old) {
        return old.sort((a, b) => a.lineOrder - b.lineOrder).map((l) => ({
            id: l.id, kind: l.kind, targetType: l.targetType, phaseId: l.phaseId, taskId: l.taskId, description: l.description,
            amount: l.amount, quantity: l.quantity, unit: l.unit, rate: l.rate, retentionApplies: l.retentionApplies, taxable: l.taxable,
            reimbursableId: l.reimbursableId, retentionReleaseId: l.retentionReleaseId,
        }));
    }
    async updateDraft(id, dto, actor) {
        await this.fin.need(actor, 'prepareInvoice');
        const inv = await this.load(id);
        if (inv.status !== 'draft')
            throw new common_1.BadRequestException('Only a draft can be edited. Issued invoices are permanent -- void and reissue, or issue a credit note, to correct one.');
        if (inv.kind === 'credit' && dto.lines)
            throw new common_1.BadRequestException('A credit note’s lines are set when it’s created -- delete it and start again to change them.');
        (0, financials_service_1.assertVersion)(inv, dto.version);
        const before = { ...inv };
        for (const k of ['invoiceDate', 'dueDate', 'periodStart', 'periodEnd']) {
            if (dto[k] !== undefined) {
                if (dto[k] && !ISO.test(dto[k]))
                    throw new common_1.BadRequestException(`${k} must be a date.`);
                inv[k] = dto[k] || null;
            }
        }
        if (!inv.invoiceDate)
            throw new common_1.BadRequestException('The invoice needs a date.');
        if (inv.dueDate && inv.dueDate < inv.invoiceDate)
            throw new common_1.BadRequestException('The due date is before the invoice date.');
        for (const k of ['reference', 'poNumber', 'description', 'billToName', 'billToEmail', 'billToAddress', 'notes'])
            if (dto[k] !== undefined)
                inv[k] = String(dto[k] ?? '').trim() || null;
        if (inv.kind !== 'credit') {
            for (const k of ['retentionPct', 'taxPct']) {
                if (dto[k] !== undefined) {
                    const n = Number(dto[k]);
                    if (!Number.isFinite(n) || n < 0 || n > 100)
                        throw new common_1.BadRequestException(`${k === 'taxPct' ? 'Tax' : 'Retention'} must be between 0 and 100.`);
                    inv[k] = (0, money_1.roundPct)(n);
                }
            }
        }
        Object.assign(inv, { updatedAt: now(), updatedBy: actor.name });
        const old = await this.lines.find({ where: { invoiceId: id } });
        let next = old;
        if (inv.kind !== 'credit') {
            const sov = (0, finance_calc_1.computeSov)((await this.fin.context(inv.projectId)).input);
            next = this.buildLines(inv, dto.lines ? dto.lines : this.asDtos(old), sov, await this.refs(inv.projectId));
        }
        const droppedReleases = old.filter((o) => o.retentionReleaseId && !next.some((n) => n.retentionReleaseId === o.retentionReleaseId)).map((o) => o.retentionReleaseId);
        await this.invoices.manager.transaction(async (m) => {
            await m.getRepository(entities_1.ProjectInvoiceEntity).save(inv);
            const gone = old.filter((o) => !next.some((n) => n.id === o.id));
            if (gone.length)
                await m.getRepository(entities_1.ProjectInvoiceLineEntity).remove(gone);
            if (next.length && next !== old)
                await m.getRepository(entities_1.ProjectInvoiceLineEntity).save(next, { chunk: 40 });
            if (droppedReleases.length)
                await m.getRepository(entities_1.RetentionReleaseEntity).update({ id: (0, typeorm_2.In)(Array.from(new Set(droppedReleases))), invoiceId: id }, { invoiceId: null });
        });
        const changes = {};
        for (const k of ['invoiceDate', 'dueDate', 'retentionPct', 'taxPct', 'billToName', 'poNumber'])
            if (String(before[k] ?? '') !== String(inv[k] ?? ''))
                changes[k] = { from: before[k] ?? null, to: inv[k] ?? null };
        if (dto.lines)
            changes.lines = { from: old.length, to: next.length };
        await this.fin.log(null, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: 'invoice_draft_changed', changes }, actor);
        return this.get(id, actor);
    }
    async removeDraft(id, actor) {
        await this.fin.need(actor, 'prepareInvoice');
        const inv = await this.load(id);
        if (inv.status !== 'draft')
            throw new common_1.BadRequestException('Issued invoices are never deleted -- void it instead.');
        await this.invoices.manager.transaction(async (m) => {
            await m.getRepository(entities_1.ProjectInvoiceLineEntity).delete({ invoiceId: id });
            await m.getRepository(entities_1.RetentionReleaseEntity).update({ invoiceId: id, status: 'approved' }, { invoiceId: null });
            await m.getRepository(entities_1.ProjectInvoiceEntity).remove(inv);
        });
        await this.attachments?.discardAll((0, task_types_1.normalizeAttachments)(inv.attachments));
        await this.fin.log(null, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: 'invoice_draft_deleted' }, actor);
        return { id, deleted: true };
    }
    async requestApproval(id, dto, actor) {
        await this.fin.need(actor, 'prepareInvoice');
        const inv = await this.load(id);
        if (inv.status !== 'draft')
            throw new common_1.BadRequestException('Only a draft goes for approval.');
        (0, financials_service_1.assertVersion)(inv, dto.version);
        if (!(await this.lines.count({ where: { invoiceId: id } })))
            throw new common_1.BadRequestException('Add at least one line first.');
        Object.assign(inv, { approvalRequestedAt: now(), approvalRequestedBy: actor.name, updatedAt: now(), updatedBy: actor.name });
        await this.invoices.save(inv);
        await this.fin.approval(null, { projectId: inv.projectId, entityType: inv.kind === 'credit' ? 'credit_note' : 'invoice', entityId: id, decision: 'submitted', comment: dto.comment }, actor);
        await this.fin.log(null, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: 'invoice_approval_requested', reason: dto.comment }, actor);
        return this.get(id, actor);
    }
    async returnDraft(id, dto, actor) {
        await this.fin.need(actor, 'issueInvoice');
        const inv = await this.load(id);
        if (inv.status !== 'draft' || !inv.approvalRequestedAt)
            throw new common_1.BadRequestException('This draft isn’t waiting for approval.');
        (0, financials_service_1.assertVersion)(inv, dto.version);
        if (!dto.comment?.trim())
            throw new common_1.BadRequestException('Say what needs changing.');
        Object.assign(inv, { approvalRequestedAt: null, approvalRequestedBy: null, updatedAt: now(), updatedBy: actor.name });
        await this.invoices.save(inv);
        await this.fin.approval(null, { projectId: inv.projectId, entityType: inv.kind === 'credit' ? 'credit_note' : 'invoice', entityId: id, decision: 'returned', comment: dto.comment }, actor);
        return this.get(id, actor);
    }
    async nextNumber(m, year, prefix = 'INV') {
        const repo = m.getRepository(entities_1.FinanceSequenceEntity);
        const id = `${prefix}-${year}`;
        let seq = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        if (!seq) {
            try {
                await repo.insert({ id, next: 1 });
            }
            catch { }
            seq = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
        }
        const n = seq.next;
        await repo.update({ id }, { next: n + 1 });
        return `${prefix}-${year}-${String(n).padStart(4, '0')}`;
    }
    async issue(id, dto, actor) {
        await this.fin.need(actor, 'issueInvoice');
        const draft = await this.load(id);
        if (draft.status !== 'draft')
            throw new common_1.BadRequestException(`This invoice is already ${draft.status}.`);
        (0, financials_service_1.assertVersion)(draft, dto.version);
        if (draft.kind === 'credit')
            return this.issueCredit(draft, dto, actor);
        const issuedId = await this.invoices.manager.transaction(async (m) => {
            const number = await this.nextNumber(m, Number((draft.invoiceDate || (0, workforce_util_1.todayISO)()).slice(0, 4)));
            const inv = await m.getRepository(entities_1.ProjectInvoiceEntity).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
            if (!inv || inv.status !== 'draft')
                throw new common_1.BadRequestException('This invoice was issued or removed meanwhile.');
            (0, financials_service_1.assertVersion)(inv, dto.version);
            const old = await m.getRepository(entities_1.ProjectInvoiceLineEntity).find({ where: { invoiceId: id } });
            if (!old.length)
                throw new common_1.BadRequestException('Add at least one line before issuing.');
            const sov = (0, finance_calc_1.computeSov)((await this.fin.context(inv.projectId)).input);
            const refs = await this.refs(inv.projectId, m);
            const lines = this.buildLines(inv, this.asDtos(old), sov, refs);
            const t = this.totalsOf(lines);
            if (sov.summary.contractWorkInvoicedC + t.contractWorkC > sov.summary.revisedContractC) {
                throw new common_1.BadRequestException(`This would bring contract work invoiced to ${fmtUsd(sov.summary.contractWorkInvoicedC + t.contractWorkC)} on a ${fmtUsd(sov.summary.revisedContractC)} contract. Only ${fmtUsd(Math.max(sov.summary.revisedContractC - sov.summary.contractWorkInvoicedC, 0))} is left.`);
            }
            if (t.totalC < 0)
                throw new common_1.BadRequestException('The invoice total can’t be negative -- use a credit note to reduce an earlier invoice.');
            Object.assign(inv, {
                status: 'issued', issuedNumber: number, issuedAt: now(), issuedById: actor.id, issuedByName: actor.name, updatedAt: now(), updatedBy: actor.name,
                contractWork: (0, money_1.fromCents)(t.contractWorkC), retentionAmount: (0, money_1.fromCents)(t.retentionC), adjustmentTotal: (0, money_1.fromCents)(t.adjustmentC), taxAmount: (0, money_1.fromCents)(t.taxC), total: (0, money_1.fromCents)(t.totalC),
            });
            await m.getRepository(entities_1.ProjectInvoiceLineEntity).save(lines, { chunk: 40 });
            await m.getRepository(entities_1.ProjectInvoiceEntity).save(inv);
            const reimbIds = lines.filter((l) => l.reimbursableId).map((l) => l.reimbursableId);
            if (reimbIds.length)
                await m.getRepository(entities_1.ReimbursableEntity).update({ id: (0, typeorm_2.In)(reimbIds) }, { status: 'billed', invoiceId: id, updatedAt: now(), updatedBy: actor.name });
            const relIds = Array.from(new Set(lines.filter((l) => l.retentionReleaseId).map((l) => l.retentionReleaseId)));
            if (relIds.length)
                await m.getRepository(entities_1.RetentionReleaseEntity).update({ id: (0, typeorm_2.In)(relIds) }, { status: 'billed', invoiceId: id, updatedAt: now(), updatedBy: actor.name });
            const s = await m.getRepository(entities_1.ProjectFinancialEntity).findOneBy({ projectId: inv.projectId });
            if (s && !s.contractLockedAt && t.contractWorkC > 0) {
                s.contractLockedAt = now();
                s.updatedAt = now();
                s.updatedBy = actor.name;
                await m.getRepository(entities_1.ProjectFinancialEntity).save(s);
            }
            await this.fin.log(m, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: 'invoice_issued', changes: { number: { from: null, to: number }, total: { from: null, to: (0, money_1.fromCents)(t.totalC) } } }, actor);
            await this.fin.approval(m, { projectId: inv.projectId, entityType: 'invoice', entityId: id, decision: inv.approvalRequestedAt ? 'approved' : 'issued', amount: (0, money_1.fromCents)(t.totalC), comment: number }, actor);
            return inv.id;
        });
        return this.get(issuedId, actor);
    }
    async void(id, dto, actor) {
        await this.fin.need(actor, 'issueInvoice');
        const inv = await this.load(id);
        if (inv.status !== 'issued')
            throw new common_1.BadRequestException(inv.status === 'draft' ? 'Delete a draft instead of voiding it.' : 'This invoice is already void.');
        (0, financials_service_1.assertVersion)(inv, dto.version);
        if (!dto.reason?.trim())
            throw new common_1.BadRequestException('Say why the invoice is being voided.');
        const live = (await this.payments.find({ where: { invoiceId: id } })).filter((p) => !p.voidedAt);
        if (live.length)
            throw new common_1.BadRequestException(`${live.length} payment(s) are recorded against this invoice -- void them first.`);
        const credits = (await this.invoices.find({ where: { creditForInvoiceId: id } })).filter((c) => c.status !== 'void');
        if (credits.length)
            throw new common_1.BadRequestException(`Credit note ${credits.map((c) => c.issuedNumber || 'draft').join(', ')} is against this invoice -- void or delete it first.`);
        Object.assign(inv, { status: 'void', voidedAt: now(), voidedById: actor.id, voidedByName: actor.name, voidReason: dto.reason.trim(), updatedAt: now(), updatedBy: actor.name });
        await this.invoices.manager.transaction(async (m) => {
            await m.getRepository(entities_1.ProjectInvoiceEntity).save(inv);
            await m.getRepository(entities_1.ReimbursableEntity).update({ invoiceId: id, status: 'billed' }, { status: 'approved', invoiceId: null, updatedAt: now(), updatedBy: actor.name });
            await m.getRepository(entities_1.RetentionReleaseEntity).update({ invoiceId: id, status: 'billed' }, { status: 'approved', invoiceId: null, updatedAt: now(), updatedBy: actor.name });
        });
        await this.fin.log(null, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: inv.kind === 'credit' ? 'credit_voided' : 'invoice_voided', changes: { status: { from: 'issued', to: 'void' } }, reason: dto.reason.trim() }, actor);
        return this.get(id, actor);
    }
    async creditRoom(invoiceId, m) {
        const repoI = m ? m.getRepository(entities_1.ProjectInvoiceEntity) : this.invoices;
        const repoL = m ? m.getRepository(entities_1.ProjectInvoiceLineEntity) : this.lines;
        const credits = (await repoI.find({ where: { creditForInvoiceId: invoiceId } })).filter((c) => c.status === 'issued');
        const creditLines = credits.length ? await repoL.find({ where: { invoiceId: (0, typeorm_2.In)(credits.map((c) => c.id)) } }) : [];
        const taken = new Map();
        for (const l of creditLines)
            if (l.creditsLineId)
                taken.set(l.creditsLineId, (taken.get(l.creditsLineId) || 0) - (0, money_1.toCents)(l.amount));
        return taken;
    }
    async owedC(inv, m) {
        const repoI = m ? m.getRepository(entities_1.ProjectInvoiceEntity) : this.invoices;
        const repoP = m ? m.getRepository(entities_1.ProjectPaymentEntity) : this.payments;
        const credits = (await repoI.find({ where: { creditForInvoiceId: inv.id } })).filter((c) => c.status === 'issued');
        const paid = (0, money_1.sumCents)((await repoP.find({ where: { invoiceId: inv.id } })).filter((p) => !p.voidedAt).map((p) => (0, money_1.toCents)(p.amount)));
        return (0, money_1.toCents)(inv.total) + (0, money_1.sumCents)(credits.map((c) => (0, money_1.toCents)(c.total))) - paid;
    }
    async createCredit(invoiceId, dto, actor) {
        await this.fin.need(actor, 'issueInvoice');
        const orig = await this.load(invoiceId);
        if (orig.status !== 'issued' || orig.kind === 'credit')
            throw new common_1.BadRequestException('Credit notes go against an issued invoice.');
        const reason = dto.reason?.trim();
        if (!reason)
            throw new common_1.BadRequestException('Say why the credit is being given.');
        const writeOff = dto.creditType === 'write_off';
        const origLines = await this.lines.find({ where: { invoiceId } });
        const cn = this.invoices.create({
            id: (0, workforce_util_1.newId)('PI'), projectId: orig.projectId, kind: 'credit', status: 'draft', invoiceDate: (0, workforce_util_1.todayISO)(), currency: orig.currency, fxRate: 1, baseCurrency: 'USD',
            reference: orig.issuedNumber, poNumber: orig.poNumber, billToName: orig.billToName, billToEmail: orig.billToEmail, billToAddress: orig.billToAddress,
            retentionPct: orig.retentionPct, taxPct: orig.taxPct, attachments: [], createdAt: now(), createdBy: actor.name,
            creditForInvoiceId: invoiceId, creditType: writeOff ? 'write_off' : 'credit', creditReason: reason,
            description: `${writeOff ? 'Write-off' : 'Credit'} against ${orig.issuedNumber}`,
        });
        let built;
        if (writeOff) {
            const owed = await this.owedC(orig);
            const amountC = dto.amount == null || dto.amount === '' ? owed : (0, money_1.toCents)(dto.amount);
            if (amountC <= 0)
                throw new common_1.BadRequestException('Nothing is owed on this invoice to write off.');
            if (amountC > owed)
                throw new common_1.BadRequestException(`Only ${fmtUsd(owed)} is owed on ${orig.issuedNumber}.`);
            built = [this.lines.create({
                    id: (0, workforce_util_1.newId)('PL'), invoiceId: cn.id, projectId: cn.projectId, kind: 'adjustment', lineOrder: 0, description: `Write-off: ${reason}`,
                    amount: (0, money_1.fromCents)(-amountC), retentionApplies: false, retentionPct: 0, retentionAmount: 0, taxable: false, taxPct: 0, taxAmount: 0,
                })];
        }
        else {
            built = this.creditLines(cn, origLines, dto.lines || [], await this.creditRoom(invoiceId));
        }
        await this.invoices.manager.transaction(async (m) => {
            await m.getRepository(entities_1.ProjectInvoiceEntity).save(cn);
            await m.getRepository(entities_1.ProjectInvoiceLineEntity).save(built, { chunk: 40 });
        });
        await this.fin.log(null, { projectId: cn.projectId, entityType: 'invoice', entityId: cn.id, action: writeOff ? 'write_off_drafted' : 'credit_drafted', changes: { for: { from: null, to: orig.issuedNumber } }, reason }, actor);
        return this.get(cn.id, actor);
    }
    creditLines(cn, origLines, wanted, taken) {
        const picked = wanted.filter((w) => (0, money_1.toCents)(w.amount) !== 0);
        if (!picked.length)
            throw new common_1.BadRequestException('Choose at least one line and how much to credit on it.');
        return picked.map((w, i) => {
            const l = origLines.find((x) => x.id === w.lineId);
            if (!l)
                throw new common_1.BadRequestException('That line isn’t on the invoice being credited.');
            if (l.kind === 'adjustment' || l.kind === 'retention_release')
                throw new common_1.BadRequestException(`“${l.description}” can’t be credited line by line -- use a write-off or a new adjustment.`);
            const amountC = (0, money_1.toCents)(w.amount);
            const roomC = (0, money_1.toCents)(l.amount) - (taken.get(l.id) || 0);
            if (amountC <= 0)
                throw new common_1.BadRequestException('Credit amounts are entered as positive figures.');
            if (amountC > roomC)
                throw new common_1.BadRequestException(`Only ${fmtUsd(roomC)} of “${l.description}” is left to credit.`);
            const m = (0, finance_calc_1.lineMath)({ kind: l.kind, amountC: -amountC, retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, taxable: l.taxable, taxPct: l.taxPct });
            return this.lines.create({
                id: (0, workforce_util_1.newId)('PL'), invoiceId: cn.id, projectId: cn.projectId, kind: l.kind, lineOrder: i, description: `Credit: ${l.description}`,
                targetType: l.targetType, phaseId: l.phaseId, taskId: l.taskId, billingMethod: l.billingMethod, contractValue: l.contractValue,
                amount: (0, money_1.fromCents)(-amountC), retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, retentionAmount: (0, money_1.fromCents)(m.retentionC),
                taxable: l.taxable, taxPct: l.taxPct, taxAmount: (0, money_1.fromCents)(m.taxC), reimbursableId: l.reimbursableId, creditsLineId: l.id,
            });
        });
    }
    async issueCredit(draft, dto, actor) {
        const issuedId = await this.invoices.manager.transaction(async (m) => {
            const number = await this.nextNumber(m, Number((draft.invoiceDate || (0, workforce_util_1.todayISO)()).slice(0, 4)), 'CN');
            const cn = await m.getRepository(entities_1.ProjectInvoiceEntity).findOne({ where: { id: draft.id }, lock: { mode: 'pessimistic_write' } });
            if (!cn || cn.status !== 'draft')
                throw new common_1.BadRequestException('This credit note was issued or removed meanwhile.');
            (0, financials_service_1.assertVersion)(cn, dto.version);
            const orig = await m.getRepository(entities_1.ProjectInvoiceEntity).findOneBy({ id: cn.creditForInvoiceId });
            if (!orig || orig.status !== 'issued')
                throw new common_1.BadRequestException('The invoice being credited is no longer issued.');
            const lines = await m.getRepository(entities_1.ProjectInvoiceLineEntity).find({ where: { invoiceId: cn.id } });
            const t = this.totalsOf(lines);
            if (t.totalC >= 0)
                throw new common_1.BadRequestException('A credit note has to reduce the invoice.');
            if (cn.creditType === 'write_off') {
                const owed = await this.owedC(orig, m);
                if (-t.totalC > owed)
                    throw new common_1.BadRequestException(`Only ${fmtUsd(owed)} is still owed on ${orig.issuedNumber}.`);
            }
            else {
                const taken = await this.creditRoom(orig.id, m);
                const origLines = await m.getRepository(entities_1.ProjectInvoiceLineEntity).find({ where: { invoiceId: orig.id } });
                for (const l of lines) {
                    const o = origLines.find((x) => x.id === l.creditsLineId);
                    if (!o)
                        throw new common_1.BadRequestException('A credited line is no longer on the original invoice.');
                    if (-(0, money_1.toCents)(l.amount) > (0, money_1.toCents)(o.amount) - (taken.get(o.id) || 0))
                        throw new common_1.BadRequestException(`“${o.description}” has been credited since -- only ${fmtUsd((0, money_1.toCents)(o.amount) - (taken.get(o.id) || 0))} is left.`);
                }
            }
            Object.assign(cn, {
                status: 'issued', issuedNumber: number, issuedAt: now(), issuedById: actor.id, issuedByName: actor.name, updatedAt: now(), updatedBy: actor.name,
                contractWork: (0, money_1.fromCents)(t.contractWorkC), retentionAmount: (0, money_1.fromCents)(t.retentionC), adjustmentTotal: (0, money_1.fromCents)(t.adjustmentC), taxAmount: (0, money_1.fromCents)(t.taxC), total: (0, money_1.fromCents)(t.totalC),
            });
            await m.getRepository(entities_1.ProjectInvoiceEntity).save(cn);
            await this.fin.log(m, { projectId: cn.projectId, entityType: 'invoice', entityId: cn.id, action: cn.creditType === 'write_off' ? 'write_off_issued' : 'credit_issued', changes: { number: { from: null, to: number }, total: { from: null, to: (0, money_1.fromCents)(t.totalC) } }, reason: cn.creditReason }, actor);
            await this.fin.approval(m, { projectId: cn.projectId, entityType: 'credit_note', entityId: cn.id, decision: 'issued', amount: (0, money_1.fromCents)(t.totalC), comment: cn.creditReason }, actor);
            return cn.id;
        });
        return this.get(issuedId, actor);
    }
    async recordPayment(invoiceId, dto, actor) {
        await this.fin.need(actor, 'recordPayment');
        const inv = await this.load(invoiceId);
        if (inv.status !== 'issued' || inv.kind === 'credit')
            throw new common_1.BadRequestException('Payments go against an issued invoice.');
        const date = dto.date || (0, workforce_util_1.todayISO)();
        if (!ISO.test(date))
            throw new common_1.BadRequestException('Give the payment date.');
        const amountC = (0, money_1.toCents)(dto.amount);
        if (amountC <= 0)
            throw new common_1.BadRequestException('The payment must be more than zero.');
        const method = dto.method || 'ach';
        if (!exports.PAYMENT_METHODS.includes(method))
            throw new common_1.BadRequestException('Unknown payment method.');
        const outstandingC = await this.owedC(inv);
        if (amountC > outstandingC)
            throw new common_1.BadRequestException(`Only ${fmtUsd(Math.max(outstandingC, 0))} is outstanding on ${inv.issuedNumber}.`);
        const p = await this.payments.save(this.payments.create({
            id: (0, workforce_util_1.newId)('PP'), invoiceId, projectId: inv.projectId, date, amount: (0, money_1.fromCents)(amountC), currency: inv.currency, fxRate: 1, method,
            bankRef: dto.bankRef?.trim() || undefined, txnRef: dto.txnRef?.trim() || undefined, notes: dto.notes?.trim() || undefined, attachments: [],
            createdAt: now(), createdBy: actor.name,
        }));
        await this.fin.log(null, { projectId: inv.projectId, entityType: 'payment', entityId: p.id, action: 'payment_recorded', changes: { amount: { from: null, to: p.amount }, invoice: { from: null, to: inv.issuedNumber } } }, actor);
        return this.get(invoiceId, actor);
    }
    async voidPayment(id, dto, actor) {
        await this.fin.need(actor, 'recordPayment');
        const p = await this.payments.findOneBy({ id });
        if (!p)
            throw new common_1.NotFoundException('Payment not found');
        if (p.voidedAt)
            throw new common_1.BadRequestException('This payment is already void.');
        (0, financials_service_1.assertVersion)(p, dto.version);
        if (!dto.reason?.trim())
            throw new common_1.BadRequestException('Say why the payment is being voided.');
        Object.assign(p, { voidedAt: now(), voidedByName: actor.name, voidReason: dto.reason.trim(), updatedAt: now(), updatedBy: actor.name });
        await this.payments.save(p);
        await this.fin.log(null, { projectId: p.projectId, entityType: 'payment', entityId: id, action: 'payment_voided', changes: { amount: { from: p.amount, to: 0 } }, reason: dto.reason.trim() }, actor);
        return this.get(p.invoiceId, actor);
    }
    async addAttachments(id, files, actor) {
        const inv = await this.load(id);
        const added = await this.attachments.upload(files, `Project ${inv.projectId}`, actor);
        inv.attachments = [...(0, task_types_1.normalizeAttachments)(inv.attachments), ...added];
        await this.invoices.save(inv);
        return (0, task_types_1.normalizeAttachments)(inv.attachments);
    }
    async addLink(id, name, url, actor) {
        const inv = await this.load(id);
        const att = { id: (0, task_types_1.subId)('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: now() };
        inv.attachments = [...(0, task_types_1.normalizeAttachments)(inv.attachments), att];
        await this.invoices.save(inv);
        return (0, task_types_1.normalizeAttachments)(inv.attachments);
    }
    async removeAttachment(id, attId) {
        const inv = await this.load(id);
        const all = (0, task_types_1.normalizeAttachments)(inv.attachments);
        const target = all.find((a) => a.id === attId);
        if (!target)
            throw new common_1.NotFoundException('Attachment not found');
        await this.attachments.discard(target);
        inv.attachments = all.filter((a) => a.id !== attId);
        await this.invoices.save(inv);
        return inv.attachments;
    }
    async attachment(id, attId) {
        const att = (0, task_types_1.normalizeAttachments)((await this.load(id)).attachments).find((a) => a.id === attId);
        if (!att)
            throw new common_1.NotFoundException('Attachment not found');
        return att;
    }
};
exports.InvoicesService = InvoicesService;
exports.InvoicesService = InvoicesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ProjectInvoiceEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ProjectInvoiceLineEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.ProjectPaymentEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.ProjectFinancialEntity)),
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.ReimbursableEntity)),
    __param(6, (0, typeorm_1.InjectRepository)(entities_1.RetentionReleaseEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        financials_service_1.FinancialsService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        attachments_service_1.AttachmentsService])
], InvoicesService);
//# sourceMappingURL=invoices.service.js.map