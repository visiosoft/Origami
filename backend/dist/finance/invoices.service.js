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
exports.InvoicesService = exports.PAYMENT_METHODS = void 0;
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
const LINE_KINDS = ['progress', 'manual', 'adjustment'];
exports.PAYMENT_METHODS = ['ach', 'check', 'wire', 'card', 'cash', 'other'];
const now = () => new Date().toISOString();
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const fmtUsd = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function billableItems(sov) {
    const out = [];
    if (sov.lump)
        out.push(sov.lump);
    for (const g of sov.groups)
        for (const r of g.rows) {
            if (r.kind === 'phase') {
                if (r.valueFromTasks)
                    out.push(...(r.children || []).filter((c) => c.ownValueC != null));
                else if (r.ownValueC != null)
                    out.push(r);
            }
            else
                out.push(r);
        }
    return out;
}
const itemKey = (x) => x.targetType === 'project' || x.kind === 'project' ? 'project' : x.taskId ? `task:${x.taskId}` : x.phaseId ? `phase:${x.phaseId}` : (x.kind === 'task' ? `task:${x.id}` : `phase:${x.id}`);
let InvoicesService = class InvoicesService {
    constructor(invoices, lines, payments, pfin, fin, attachments) {
        this.invoices = invoices;
        this.lines = lines;
        this.payments = payments;
        this.pfin = pfin;
        this.fin = fin;
        this.attachments = attachments;
    }
    async load(id) {
        const inv = await this.invoices.findOneBy({ id });
        if (!inv)
            throw new common_1.NotFoundException('Invoice not found');
        return inv;
    }
    present(inv, lines, pays) {
        const live = (0, finance_calc_1.invoiceTotals)(lines.map((l) => ({ kind: l.kind, amountC: (0, money_1.toCents)(l.amount), retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, taxable: l.taxable, taxPct: l.taxPct })));
        const t = inv.status === 'draft' ? live : {
            contractWorkC: (0, money_1.toCents)(inv.contractWork), retentionC: (0, money_1.toCents)(inv.retentionAmount), adjustmentC: (0, money_1.toCents)(inv.adjustmentTotal), taxC: (0, money_1.toCents)(inv.taxAmount), totalC: (0, money_1.toCents)(inv.total),
        };
        const paidC = inv.status === 'issued' ? (0, money_1.sumCents)(pays.filter((p) => !p.voidedAt).map((p) => (0, money_1.toCents)(p.amount))) : 0;
        const outstandingC = inv.status === 'issued' ? t.totalC - paidC : 0;
        const overdue = inv.status === 'issued' && outstandingC > 0 && !!inv.dueDate && inv.dueDate < (0, workforce_util_1.todayISO)();
        const paymentStatus = inv.status === 'draft' ? 'draft' : inv.status === 'void' ? 'void' : outstandingC <= 0 ? 'paid' : overdue ? 'overdue' : paidC > 0 ? 'partially_paid' : 'unpaid';
        return { ...inv, ...(0, finance_calc_1.toDollars)({ ...t, paidC, outstandingC }), paymentStatus, overdue, attachments: (0, task_types_1.normalizeAttachments)(inv.attachments) };
    }
    async list(projectId, actor) {
        await this.need(actor, 'view');
        const [invs, lines, pays] = await Promise.all([
            this.invoices.find({ where: { projectId } }), this.lines.find({ where: { projectId } }), this.payments.find({ where: { projectId } }),
        ]);
        return invs.map((inv) => this.present(inv, lines.filter((l) => l.invoiceId === inv.id), pays.filter((p) => p.invoiceId === inv.id)))
            .sort((a, b) => (b.invoiceDate || '').localeCompare(a.invoiceDate || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
    async get(id, actor) {
        await this.need(actor, 'view');
        const inv = await this.load(id);
        const [lines, pays] = await Promise.all([this.lines.find({ where: { invoiceId: id } }), this.payments.find({ where: { invoiceId: id } })]);
        const sorted = lines.sort((a, b) => a.lineOrder - b.lineOrder);
        return {
            ...this.present(inv, sorted, pays),
            lines: sorted.map((l) => ({ ...l, ...(0, finance_calc_1.toDollars)((0, finance_calc_1.lineMath)({ kind: l.kind, amountC: (0, money_1.toCents)(l.amount), retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, taxable: l.taxable, taxPct: l.taxPct })) })),
            payments: pays.sort((a, b) => a.date.localeCompare(b.date)),
        };
    }
    async projectPayments(projectId, actor) {
        await this.need(actor, 'view');
        const [pays, invs] = await Promise.all([this.payments.find({ where: { projectId } }), this.invoices.find({ where: { projectId } })]);
        const num = new Map(invs.map((i) => [i.id, i.issuedNumber]));
        return pays.map((p) => ({ ...p, invoiceNumber: num.get(p.invoiceId) })).sort((a, b) => b.date.localeCompare(a.date));
    }
    async need(actor, what) {
        const r = await this.fin.rights(actor);
        if (!r[what])
            throw new common_1.ForbiddenException(what === 'view' ? "Your role doesn't include project financials." : "Your role doesn't allow invoicing or payments.");
    }
    async createDraft(projectId, dto, actor) {
        await this.need(actor, 'manage');
        const { row: s } = await this.fin.settingsFor(projectId);
        if (!s)
            throw new common_1.BadRequestException('Set up this project’s financials (contract value, retention, tax) before invoicing.');
        const ctx = await this.fin.context(projectId);
        const sov = (0, finance_calc_1.computeSov)(ctx.input);
        const items = billableItems(sov);
        const standard = dto.kind === 'standard';
        const wanted = standard ? [] : (dto.billReady || !dto.items?.length
            ? items
            : items.filter((r) => dto.items.some((x) => itemKey({ kind: x.kind, id: x.id }) === itemKey({ kind: r.kind, id: r.id })))).filter((r) => r.billableC > 0);
        if (!standard && !wanted.length)
            throw new common_1.BadRequestException('Nothing is ready to invoice: no item has earned more than has been billed. Update progress first, or start a standard invoice for manual items.');
        const today = (0, workforce_util_1.todayISO)();
        const inv = this.invoices.create({
            id: (0, workforce_util_1.newId)('PI'), projectId, kind: dto.kind === 'standard' ? 'standard' : 'progress', status: 'draft', invoiceDate: today,
            dueDate: addDays(today, s.paymentTermsDays ?? 30), currency: s.currency || 'USD', fxRate: 1, baseCurrency: 'USD',
            reference: s.contractNumber, poNumber: s.poNumber, description: dto.description, billToName: s.billToName, billToEmail: s.billToEmail, billToAddress: s.billToAddress,
            retentionPct: s.retentionPct, taxPct: s.taxPct, attachments: [], createdAt: now(), createdBy: actor.name,
        });
        const lineDtos = wanted.map((r) => ({
            kind: 'progress', targetType: r.kind, phaseId: r.kind === 'phase' ? r.id : r.kind === 'task' ? r.phaseId : null, taskId: r.kind === 'task' ? r.id : null,
            description: r.name, amount: (0, money_1.fromCents)(r.billableC),
        }));
        const built = this.buildLines(inv, lineDtos, sov);
        await this.invoices.manager.transaction(async (m) => {
            await m.getRepository(entities_1.ProjectInvoiceEntity).save(inv);
            if (built.length)
                await m.getRepository(entities_1.ProjectInvoiceLineEntity).save(built, { chunk: 40 });
        });
        await this.fin.log(null, { projectId, entityType: 'invoice', entityId: inv.id, action: 'invoice_drafted', changes: { lines: { from: null, to: built.length } } }, actor);
        return this.get(inv.id, actor);
    }
    buildLines(inv, dtos, sov) {
        const items = new Map(billableItems(sov).map((r) => [itemKey({ kind: r.kind, id: r.id }), r]));
        const claimed = new Map();
        return dtos.map((d, i) => {
            if (!LINE_KINDS.includes(d.kind))
                throw new common_1.BadRequestException('A line is progress, manual or an adjustment.');
            const base = {
                id: d.id && d.id.startsWith('PL') ? d.id : (0, workforce_util_1.newId)('PL'), invoiceId: inv.id, projectId: inv.projectId, kind: d.kind, lineOrder: i,
                description: String(d.description || '').trim(), unit: d.unit || undefined,
            };
            let amountC;
            let retPct = Number(inv.retentionPct) || 0;
            let taxPct = Number(inv.taxPct) || 0;
            if (d.kind === 'progress') {
                const key = itemKey({ targetType: d.targetType, kind: d.targetType || undefined, phaseId: d.phaseId, taskId: d.taskId });
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
            else {
                amountC = (0, money_1.toCents)(d.amount);
                if (!base.description)
                    throw new common_1.BadRequestException(`Line ${i + 1}: say what the adjustment is for.`);
                if (!amountC)
                    throw new common_1.BadRequestException(`Line ${i + 1}: an adjustment needs an amount (negative for a discount).`);
                retPct = 0;
            }
            const retentionApplies = d.kind === 'adjustment' ? false : d.retentionApplies ?? true;
            const taxable = d.taxable ?? (d.kind !== 'adjustment' && taxPct > 0);
            const m = (0, finance_calc_1.lineMath)({ kind: d.kind, amountC, retentionApplies, retentionPct: retPct, taxable, taxPct });
            return this.lines.create({
                ...base, amount: (0, money_1.fromCents)(amountC), retentionApplies, retentionPct: retentionApplies ? retPct : 0,
                retentionAmount: (0, money_1.fromCents)(m.retentionC), taxable, taxPct: taxable ? taxPct : 0, taxAmount: (0, money_1.fromCents)(m.taxC),
            });
        });
    }
    async updateDraft(id, dto, actor) {
        await this.need(actor, 'manage');
        const inv = await this.load(id);
        if (inv.status !== 'draft')
            throw new common_1.BadRequestException('Only a draft can be edited. Issued invoices are permanent -- void and reissue to correct one.');
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
        for (const k of ['retentionPct', 'taxPct']) {
            if (dto[k] !== undefined) {
                const n = Number(dto[k]);
                if (!Number.isFinite(n) || n < 0 || n > 100)
                    throw new common_1.BadRequestException(`${k === 'taxPct' ? 'Tax' : 'Retention'} must be between 0 and 100.`);
                inv[k] = (0, money_1.roundPct)(n);
            }
        }
        Object.assign(inv, { updatedAt: now(), updatedBy: actor.name });
        const old = await this.lines.find({ where: { invoiceId: id } });
        const next = dto.lines ? this.buildLines(inv, dto.lines, (0, finance_calc_1.computeSov)((await this.fin.context(inv.projectId)).input))
            : this.buildLines(inv, old.sort((a, b) => a.lineOrder - b.lineOrder).map((l) => ({ ...l, amount: l.amount })), (0, finance_calc_1.computeSov)((await this.fin.context(inv.projectId)).input));
        await this.invoices.manager.transaction(async (m) => {
            await m.getRepository(entities_1.ProjectInvoiceEntity).save(inv);
            const gone = old.filter((o) => !next.some((n) => n.id === o.id));
            if (gone.length)
                await m.getRepository(entities_1.ProjectInvoiceLineEntity).remove(gone);
            if (next.length)
                await m.getRepository(entities_1.ProjectInvoiceLineEntity).save(next, { chunk: 40 });
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
        await this.need(actor, 'manage');
        const inv = await this.load(id);
        if (inv.status !== 'draft')
            throw new common_1.BadRequestException('Issued invoices are never deleted -- void it instead.');
        await this.invoices.manager.transaction(async (m) => {
            await m.getRepository(entities_1.ProjectInvoiceLineEntity).delete({ invoiceId: id });
            await m.getRepository(entities_1.ProjectInvoiceEntity).remove(inv);
        });
        await this.attachments?.discardAll((0, task_types_1.normalizeAttachments)(inv.attachments));
        await this.fin.log(null, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: 'invoice_draft_deleted' }, actor);
        return { id, deleted: true };
    }
    async nextNumber(m, year) {
        const repo = m.getRepository(entities_1.FinanceSequenceEntity);
        const id = `INV-${year}`;
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
        return `INV-${year}-${String(n).padStart(4, '0')}`;
    }
    async issue(id, dto, actor) {
        await this.need(actor, 'manage');
        const draft = await this.load(id);
        if (draft.status !== 'draft')
            throw new common_1.BadRequestException(`This invoice is already ${draft.status}.`);
        (0, financials_service_1.assertVersion)(draft, dto.version);
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
            const lines = this.buildLines(inv, old.sort((a, b) => a.lineOrder - b.lineOrder).map((l) => ({
                id: l.id, kind: l.kind, targetType: l.targetType, phaseId: l.phaseId, taskId: l.taskId, description: l.description,
                amount: l.amount, quantity: l.quantity, unit: l.unit, rate: l.rate, retentionApplies: l.retentionApplies, taxable: l.taxable,
            })), sov);
            const t = (0, finance_calc_1.invoiceTotals)(lines.map((l) => ({ kind: l.kind, amountC: (0, money_1.toCents)(l.amount), retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, taxable: l.taxable, taxPct: l.taxPct })));
            if (sov.summary.contractWorkInvoicedC + t.contractWorkC > sov.summary.revisedContractC) {
                throw new common_1.BadRequestException(`This would bring contract work invoiced to ${fmtUsd(sov.summary.contractWorkInvoicedC + t.contractWorkC)} on a ${fmtUsd(sov.summary.revisedContractC)} contract. Only ${fmtUsd(Math.max(sov.summary.revisedContractC - sov.summary.contractWorkInvoicedC, 0))} is left.`);
            }
            if (t.totalC < 0)
                throw new common_1.BadRequestException('The invoice total can’t be negative.');
            Object.assign(inv, {
                status: 'issued', issuedNumber: number, issuedAt: now(), issuedById: actor.id, issuedByName: actor.name, updatedAt: now(), updatedBy: actor.name,
                contractWork: (0, money_1.fromCents)(t.contractWorkC), retentionAmount: (0, money_1.fromCents)(t.retentionC), adjustmentTotal: (0, money_1.fromCents)(t.adjustmentC), taxAmount: (0, money_1.fromCents)(t.taxC), total: (0, money_1.fromCents)(t.totalC),
            });
            await m.getRepository(entities_1.ProjectInvoiceLineEntity).save(lines, { chunk: 40 });
            await m.getRepository(entities_1.ProjectInvoiceEntity).save(inv);
            const s = await m.getRepository(entities_1.ProjectFinancialEntity).findOneBy({ projectId: inv.projectId });
            if (s && !s.contractLockedAt) {
                s.contractLockedAt = now();
                s.updatedAt = now();
                s.updatedBy = actor.name;
                await m.getRepository(entities_1.ProjectFinancialEntity).save(s);
            }
            await this.fin.log(m, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: 'invoice_issued', changes: { number: { from: null, to: number }, total: { from: null, to: (0, money_1.fromCents)(t.totalC) } } }, actor);
            return inv.id;
        });
        return this.get(issuedId, actor);
    }
    async void(id, dto, actor) {
        await this.need(actor, 'manage');
        const inv = await this.load(id);
        if (inv.status !== 'issued')
            throw new common_1.BadRequestException(inv.status === 'draft' ? 'Delete a draft instead of voiding it.' : 'This invoice is already void.');
        (0, financials_service_1.assertVersion)(inv, dto.version);
        if (!dto.reason?.trim())
            throw new common_1.BadRequestException('Say why the invoice is being voided.');
        const live = (await this.payments.find({ where: { invoiceId: id } })).filter((p) => !p.voidedAt);
        if (live.length)
            throw new common_1.BadRequestException(`${live.length} payment(s) are recorded against this invoice -- void them first.`);
        Object.assign(inv, { status: 'void', voidedAt: now(), voidedById: actor.id, voidedByName: actor.name, voidReason: dto.reason.trim(), updatedAt: now(), updatedBy: actor.name });
        await this.invoices.save(inv);
        await this.fin.log(null, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: 'invoice_voided', changes: { status: { from: 'issued', to: 'void' } }, reason: dto.reason.trim() }, actor);
        return this.get(id, actor);
    }
    async recordPayment(invoiceId, dto, actor) {
        await this.need(actor, 'manage');
        const inv = await this.load(invoiceId);
        if (inv.status !== 'issued')
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
        const paidC = (0, money_1.sumCents)((await this.payments.find({ where: { invoiceId } })).filter((p) => !p.voidedAt).map((p) => (0, money_1.toCents)(p.amount)));
        const outstandingC = (0, money_1.toCents)(inv.total) - paidC;
        if (amountC > outstandingC)
            throw new common_1.BadRequestException(`Only ${fmtUsd(outstandingC)} is outstanding on ${inv.issuedNumber}.`);
        const p = await this.payments.save(this.payments.create({
            id: (0, workforce_util_1.newId)('PP'), invoiceId, projectId: inv.projectId, date, amount: (0, money_1.fromCents)(amountC), currency: inv.currency, fxRate: 1, method,
            bankRef: dto.bankRef?.trim() || undefined, txnRef: dto.txnRef?.trim() || undefined, notes: dto.notes?.trim() || undefined, attachments: [],
            createdAt: now(), createdBy: actor.name,
        }));
        await this.fin.log(null, { projectId: inv.projectId, entityType: 'payment', entityId: p.id, action: 'payment_recorded', changes: { amount: { from: null, to: p.amount }, invoice: { from: null, to: inv.issuedNumber } } }, actor);
        return this.get(invoiceId, actor);
    }
    async voidPayment(id, dto, actor) {
        await this.need(actor, 'manage');
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
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        financials_service_1.FinancialsService,
        attachments_service_1.AttachmentsService])
], InvoicesService);
//# sourceMappingURL=invoices.service.js.map