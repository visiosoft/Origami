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
exports.CostsService = exports.COST_TYPES = exports.COMMITMENT_TYPES = void 0;
exports.summarizeLabor = summarizeLabor;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const attachments_service_1 = require("../google/attachments.service");
const task_types_1 = require("../database/task.types");
const workforce_util_1 = require("../manpower/workforce.util");
const settings_service_1 = require("../settings/settings.service");
const payroll_calc_1 = require("../manpower/payroll.calc");
const finance_calc_1 = require("./finance.calc");
const financials_service_1 = require("./financials.service");
const costs_calc_1 = require("./costs.calc");
const money_1 = require("./money");
exports.COMMITMENT_TYPES = ['subcontract', 'purchase_order', 'service'];
exports.COST_TYPES = ['vendor_bill', 'subcontract_invoice', 'material', 'equipment', 'other'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const now = () => new Date().toISOString();
const fmtUsd = (c) => (c < 0 ? '-$' : '$') + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const money = (v, what, allowZero = false) => {
    const c = (0, money_1.toCents)(v);
    if (!Number.isFinite(c) || (allowZero ? c < 0 : c <= 0))
        throw new common_1.BadRequestException(`${what} must be ${allowZero ? 'zero or more' : 'more than zero'}.`);
    return (0, money_1.fromCents)(c);
};
let CostsService = class CostsService {
    constructor(fin, settings, budget, commitments, commitmentLines, entries, forecasts, cos, coItems, reimbs, timesheets, timesheetLines, dailyLogs, laborEntries, employees, codes, contractors, attachments) {
        this.fin = fin;
        this.settings = settings;
        this.budget = budget;
        this.commitments = commitments;
        this.commitmentLines = commitmentLines;
        this.entries = entries;
        this.forecasts = forecasts;
        this.cos = cos;
        this.coItems = coItems;
        this.reimbs = reimbs;
        this.timesheets = timesheets;
        this.timesheetLines = timesheetLines;
        this.dailyLogs = dailyLogs;
        this.laborEntries = laborEntries;
        this.employees = employees;
        this.codes = codes;
        this.contractors = contractors;
        this.attachments = attachments;
    }
    async canSee(actor) {
        const r = await this.fin.rights(actor);
        if (!r.viewProfitability && !r.manageCosts)
            await this.fin.need(actor, 'viewProfitability');
        return r;
    }
    async laborSettings() {
        let saved = {};
        try {
            saved = JSON.parse((await this.settings.get('payroll.settings')) || '{}');
        }
        catch {
            saved = {};
        }
        const s = { ...payroll_calc_1.DEFAULT_PAYROLL_SETTINGS, ...saved, otMultipliers: { ...payroll_calc_1.DEFAULT_PAYROLL_SETTINGS.otMultipliers, ...(saved.otMultipliers || {}) } };
        return { standardDayHours: Number(s.standardDayHours) || 8, monthDays: Number(s.monthDays) || 21.67, otMultiplier: Number(s.otMultipliers.normal) || 1.5 };
    }
    async laborAll() {
        const [sheets, logs, people, s] = await Promise.all([
            this.timesheets.find({ where: { status: 'approved' } }), this.dailyLogs.find({ where: { status: 'approved' } }), this.employees.find(), this.laborSettings(),
        ]);
        const [tsLines, logEntries] = await Promise.all([
            sheets.length ? this.timesheetLines.find({ where: { timesheetId: (0, typeorm_2.In)(sheets.map((x) => x.id)), kind: 'project' } }) : Promise.resolve([]),
            logs.length ? this.laborEntries.find({ where: { dailyLogId: (0, typeorm_2.In)(logs.map((x) => x.id)) } }) : Promise.resolve([]),
        ]);
        const facts = [];
        for (const l of tsLines) {
            if (!l.projectId)
                continue;
            for (const [date, d] of Object.entries(l.days || {}))
                facts.push({ employeeId: l.employeeId, projectId: l.projectId, date, csiCodeId: l.csiCodeId || null, hours: Number(d?.hours) || 0, source: 'timesheet' });
        }
        const logById = new Map(logs.map((x) => [x.id, x]));
        for (const e of logEntries) {
            const log = logById.get(e.dailyLogId);
            if (log)
                facts.push({ employeeId: e.employeeId, projectId: log.projectId, date: log.date, csiCodeId: e.csiCodeId || null, hours: Number(e.hours) || 0, source: 'daily_log' });
        }
        return (0, costs_calc_1.laborLines)(facts, new Map(people.map((p) => [p.id, { id: p.id, name: p.name, payType: p.payType, payRate: p.payRate, overtimeRate: p.overtimeRate }])), s);
    }
    async context(projectId, labor) {
        const [budget, commitments, lines, entries, forecasts, cos, reimbs, s] = await Promise.all([
            this.budget.find({ where: { projectId } }), this.commitments.find({ where: { projectId } }), this.commitmentLines.find({ where: { projectId } }),
            this.entries.find({ where: { projectId } }), this.forecasts.find({ where: { projectId } }), this.cos.find({ where: { projectId, status: 'approved' } }),
            this.reimbs.find({ where: { projectId } }), this.fin.settingsFor(projectId),
        ]);
        const coItems = cos.length ? await this.coItems.find({ where: { changeOrderId: (0, typeorm_2.In)(cos.map((c) => c.id)) } }) : [];
        const burden = Number(s.value.laborBurdenPct) || 0;
        const myLabor = (labor || await this.laborAll()).filter((l) => l.projectId === projectId);
        const live = entries.filter((e) => e.status !== 'void');
        const jc = (0, costs_calc_1.computeJobCost)({
            budgetLines: budget.map((b) => ({ csiCodeId: b.csiCodeId, amountC: (0, money_1.toCents)(b.amount) })),
            coCosts: coItems.filter((i) => i.cost != null).map((i) => ({ csiCodeId: i.csiCodeId, amountC: (0, money_1.toCents)(i.cost ?? 0) })),
            commitments: commitments.map((c) => ({ id: c.id, status: c.status, lines: lines.filter((l) => l.commitmentId === c.id).map((l) => ({ csiCodeId: l.csiCodeId, amountC: (0, money_1.toCents)(l.amount) })) })),
            costEntries: live.map((e) => ({ commitmentId: e.commitmentId, csiCodeId: e.csiCodeId, amountC: (0, money_1.toCents)(e.amount), status: e.status })),
            labor: myLabor.map((l) => ({ csiCodeId: l.csiCodeId, costC: (0, costs_calc_1.burdened)(l.wageC, burden), hours: l.hours })),
            reimbursables: reimbs.filter((r) => r.status === 'approved' || r.status === 'billed').map((r) => ({ csiCodeId: r.csiCodeId, costC: (0, money_1.toCents)(r.cost) })),
            forecasts: new Map(forecasts.map((f) => [f.csiCodeId || costs_calc_1.NO_CODE, (0, money_1.toCents)(f.eac)])),
        });
        return { jc, budget, commitments, lines, entries, forecasts, burden, labor: myLabor, reimbs, settings: s.value };
    }
    async overview(projectId, actor) {
        const rights = await this.canSee(actor);
        await this.fin.project(projectId);
        const [ctx, sovCtx, codes, contractors] = await Promise.all([this.context(projectId), this.fin.context(projectId), this.codes.find(), this.contractors.find()]);
        const sov = (0, finance_calc_1.computeSov)(sovCtx.input);
        const codeOf = new Map(codes.map((c) => [c.id, c]));
        const reimbCostC = (0, money_1.sumCents)(ctx.reimbs.filter((r) => r.status === 'approved' || r.status === 'billed').map((r) => (0, money_1.toCents)(r.cost)));
        const prof = (0, costs_calc_1.profitability)({
            contractC: sov.summary.revisedContractC, evC: sov.summary.evC, contractWorkInvoicedC: sov.summary.contractWorkInvoicedC,
            actualC: ctx.jc.totals.actualC, eacC: ctx.jc.totals.eacC, reimbursablesBilledC: sov.summary.reimbursablesBilledC, reimbursableCostC: reimbCostC,
        });
        const billedOn = (id) => (0, money_1.sumCents)(ctx.entries.filter((e) => e.commitmentId === id && e.status !== 'void').map((e) => (0, money_1.toCents)(e.amount)));
        const rows = ctx.jc.rows.map((r) => ({ ...r, code: r.csiCodeId ? codeOf.get(r.csiCodeId)?.code || '?' : '', division: r.csiCodeId ? codeOf.get(r.csiCodeId)?.division || 'Unknown code' : 'No cost code' }))
            .sort((a, b) => (a.csiCodeId ? 0 : 1) - (b.csiCodeId ? 0 : 1) || a.code.localeCompare(b.code, undefined, { numeric: true }));
        return {
            rights: { manageCosts: rights.manageCosts, approveCosts: rights.approveCosts, viewProfitability: rights.viewProfitability },
            originalBudget: ctx.settings.originalBudget, laborBurdenPct: ctx.burden,
            ...(0, finance_calc_1.toDollars)({ rows, totals: ctx.jc.totals, profitability: prof }),
            budgetLines: ctx.budget.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
            commitments: ctx.commitments.map((c) => {
                const ls = ctx.lines.filter((l) => l.commitmentId === c.id).sort((a, b) => a.lineOrder - b.lineOrder);
                const totalC = (0, money_1.sumCents)(ls.map((l) => (0, money_1.toCents)(l.amount)));
                const billedC = billedOn(c.id);
                return { ...c, attachments: (0, task_types_1.normalizeAttachments)(c.attachments), lines: ls, ...(0, finance_calc_1.toDollars)({ totalC, billedC, remainingC: c.status === 'approved' ? Math.max(totalC - billedC, 0) : 0 }) };
            }).sort((a, b) => a.number.localeCompare(b.number)),
            entries: ctx.entries.map((e) => ({ ...e, attachments: (0, task_types_1.normalizeAttachments)(e.attachments) })).sort((a, b) => b.date.localeCompare(a.date)),
            forecasts: ctx.forecasts,
            labor: summarizeLabor(ctx.labor, ctx.burden),
            contractors: contractors.filter((c) => c.status !== 'ended').map((c) => ({ id: c.id, name: c.companyName })),
        };
    }
    async saveBudgetLine(projectId, dto, actor) {
        await this.fin.need(actor, 'manageCosts');
        await this.fin.project(projectId);
        let row = dto.id ? await this.budget.findOneBy({ id: dto.id }) : null;
        if (dto.id && !row)
            throw new common_1.NotFoundException('Budget line not found');
        if (row) {
            (0, financials_service_1.assertVersion)(row, dto.version);
            if (row.projectId !== projectId)
                throw new common_1.BadRequestException('That line belongs to another project.');
        }
        const before = row ? { ...row } : null;
        row = row || this.budget.create({ id: (0, workforce_util_1.newId)('CB'), projectId, createdAt: now(), createdBy: actor.name });
        if (dto.amount !== undefined)
            row.amount = money(dto.amount, 'The budget', true);
        if (row.amount == null)
            throw new common_1.BadRequestException('Give the budget amount.');
        for (const k of ['csiCodeId', 'phaseId', 'taskId', 'description', 'notes'])
            if (dto[k] !== undefined)
                row[k] = String(dto[k] ?? '').trim() || null;
        Object.assign(row, { updatedAt: now(), updatedBy: actor.name });
        await this.budget.save(row);
        await this.fin.log(null, { projectId, entityType: 'budget', entityId: row.id, action: before ? 'budget_changed' : 'budget_added', changes: { amount: { from: before?.amount ?? null, to: row.amount } } }, actor);
        return this.overview(projectId, actor);
    }
    async removeBudgetLine(id, actor) {
        await this.fin.need(actor, 'manageCosts');
        const row = await this.budget.findOneBy({ id });
        if (!row)
            throw new common_1.NotFoundException('Budget line not found');
        await this.budget.remove(row);
        await this.fin.log(null, { projectId: row.projectId, entityType: 'budget', entityId: id, action: 'budget_removed', changes: { amount: { from: row.amount, to: null } } }, actor);
        return this.overview(row.projectId, actor);
    }
    async setForecast(projectId, dto, actor) {
        await this.fin.need(actor, 'manageCosts');
        const id = `${projectId}:${dto.csiCodeId || costs_calc_1.NO_CODE}`;
        const row = await this.forecasts.findOneBy({ id });
        if (dto.eac == null || dto.eac === '') {
            if (row)
                await this.forecasts.remove(row);
        }
        else {
            const eac = money(dto.eac, 'The forecast', true);
            await this.forecasts.save({ ...(row || { id, projectId, csiCodeId: dto.csiCodeId || null, createdAt: now(), createdBy: actor.name }), eac, note: dto.note?.trim() || null, updatedAt: now(), updatedBy: actor.name });
        }
        await this.fin.log(null, { projectId, entityType: 'forecast', entityId: id, action: 'forecast_set', changes: { eac: { from: row?.eac ?? null, to: dto.eac === '' ? null : dto.eac ?? null } }, reason: dto.note }, actor);
        return this.overview(projectId, actor);
    }
    async commitment(id) {
        const c = await this.commitments.findOneBy({ id });
        if (!c)
            throw new common_1.NotFoundException('Commitment not found');
        return c;
    }
    linesFrom(c, dtos) {
        return dtos.map((d, i) => {
            const description = String(d.description || '').trim();
            if (!description)
                throw new common_1.BadRequestException(`Line ${i + 1}: describe it.`);
            return this.commitmentLines.create({
                id: d.id && String(d.id).startsWith('CML') ? d.id : (0, workforce_util_1.newId)('CML'), commitmentId: c.id, projectId: c.projectId, lineOrder: i, description,
                csiCodeId: d.csiCodeId || null, phaseId: d.phaseId || null, taskId: d.taskId || null, amount: money(d.amount, `Line ${i + 1}'s amount`),
            });
        });
    }
    async saveCommitment(projectId, dto, actor) {
        const rights = await this.fin.need(actor, 'manageCosts');
        await this.fin.project(projectId);
        let c = dto.id ? await this.commitment(dto.id) : null;
        if (c) {
            (0, financials_service_1.assertVersion)(c, dto.version);
            if (c.status === 'closed' || c.status === 'void')
                throw new common_1.BadRequestException(`This commitment is ${c.status}.`);
            if (c.status === 'approved' && !rights.approveCosts)
                throw new common_1.BadRequestException('It’s approved -- only someone who approves costs can revise it.');
            if (c.status === 'approved' && dto.lines && !String(dto.reason || '').trim())
                throw new common_1.BadRequestException('Say why an approved commitment is being revised.');
        }
        const type = exports.COMMITMENT_TYPES.includes(dto.type) ? dto.type : c?.type || 'subcontract';
        const before = c ? { ...c } : null;
        if (!c) {
            const prefix = type === 'subcontract' ? 'SC' : 'PO';
            const existing = (await this.commitments.find({ where: { projectId } })).filter((x) => x.number.startsWith(prefix));
            const n = existing.reduce((m, x) => Math.max(m, Number(x.number.split('-').pop()) || 0), 0) + 1;
            c = this.commitments.create({ id: (0, workforce_util_1.newId)('CM'), projectId, number: `${prefix}-${String(n).padStart(3, '0')}`, type, status: 'draft', attachments: [], createdAt: now(), createdBy: actor.name });
        }
        c.type = type;
        for (const k of ['title', 'vendorName', 'contractorId', 'scope', 'notes'])
            if (dto[k] !== undefined)
                c[k] = String(dto[k] ?? '').trim() || null;
        if (dto.dateIssued !== undefined) {
            if (dto.dateIssued && !ISO.test(dto.dateIssued))
                throw new common_1.BadRequestException('The issue date must be a date.');
            c.dateIssued = dto.dateIssued || null;
        }
        if (c.contractorId && !c.vendorName)
            c.vendorName = (await this.contractors.findOneBy({ id: c.contractorId }))?.companyName;
        if (!c.title)
            throw new common_1.BadRequestException('Give it a title.');
        if (!c.vendorName)
            throw new common_1.BadRequestException('Name the subcontractor or vendor.');
        Object.assign(c, { updatedAt: now(), updatedBy: actor.name });
        const old = await this.commitmentLines.find({ where: { commitmentId: c.id } });
        const next = dto.lines ? this.linesFrom(c, dto.lines) : old;
        if (c.status === 'approved') {
            const billed = (0, money_1.sumCents)((await this.entries.find({ where: { commitmentId: c.id } })).filter((e) => e.status !== 'void').map((e) => (0, money_1.toCents)(e.amount)));
            const total = (0, money_1.sumCents)(next.map((l) => (0, money_1.toCents)(l.amount)));
            if (total < billed)
                throw new common_1.BadRequestException(`${fmtUsd(billed)} has already been billed against it -- it can't be revised below that.`);
        }
        await this.commitments.manager.transaction(async (m) => {
            await m.getRepository(entities_1.CommitmentEntity).save(c);
            if (dto.lines) {
                const gone = old.filter((o) => !next.some((n) => n.id === o.id));
                if (gone.length)
                    await m.getRepository(entities_1.CommitmentLineEntity).remove(gone);
                if (next.length)
                    await m.getRepository(entities_1.CommitmentLineEntity).save(next, { chunk: 40 });
            }
        });
        const totalOf = (ls) => (0, money_1.fromCents)((0, money_1.sumCents)(ls.map((l) => (0, money_1.toCents)(l.amount))));
        await this.fin.log(null, {
            projectId, entityType: 'commitment', entityId: c.id, action: before ? (before.status === 'approved' ? 'commitment_revised' : 'commitment_changed') : 'commitment_created',
            changes: { total: { from: before ? totalOf(old) : null, to: totalOf(next) }, ...(before ? {} : { number: { from: null, to: c.number } }) }, reason: dto.reason,
        }, actor);
        return this.overview(projectId, actor);
    }
    async commitmentStep(id, action, dto, actor) {
        const c = await this.commitment(id);
        (0, financials_service_1.assertVersion)(c, dto.version);
        const lines = await this.commitmentLines.find({ where: { commitmentId: id } });
        const at = now();
        const before = c.status;
        if (action === 'approve') {
            await this.fin.need(actor, 'approveCosts');
            if (c.status !== 'draft')
                throw new common_1.BadRequestException(`This commitment is ${c.status}.`);
            if (!lines.length)
                throw new common_1.BadRequestException('Add at least one line first.');
            Object.assign(c, { status: 'approved', approvedAt: at, approvedBy: actor.name, dateIssued: c.dateIssued || (0, workforce_util_1.todayISO)() });
        }
        else if (action === 'close') {
            await this.fin.need(actor, 'approveCosts');
            if (c.status !== 'approved')
                throw new common_1.BadRequestException('Only an approved commitment can be closed.');
            Object.assign(c, { status: 'closed', closedAt: at, closedBy: actor.name, closedReason: dto.reason?.trim() || 'Complete' });
        }
        else if (action === 'void') {
            await this.fin.need(actor, 'approveCosts');
            if (!dto.reason?.trim())
                throw new common_1.BadRequestException('Say why it’s being voided.');
            const billed = (await this.entries.find({ where: { commitmentId: id } })).filter((e) => e.status !== 'void');
            if (billed.length)
                throw new common_1.BadRequestException(`${billed.length} cost(s) are recorded against it -- close it instead, or void those first.`);
            Object.assign(c, { status: 'void', closedAt: at, closedBy: actor.name, closedReason: dto.reason.trim() });
        }
        else if (action === 'reopen') {
            await this.fin.need(actor, 'approveCosts');
            if (c.status !== 'closed')
                throw new common_1.BadRequestException('Only a closed commitment can be reopened.');
            Object.assign(c, { status: 'approved', closedAt: null, closedBy: null, closedReason: null });
        }
        else if (action === 'delete') {
            await this.fin.need(actor, 'manageCosts');
            if (c.status !== 'draft')
                throw new common_1.BadRequestException('Only a draft can be deleted -- void it instead.');
            await this.commitments.manager.transaction(async (m) => {
                await m.getRepository(entities_1.CommitmentLineEntity).delete({ commitmentId: id });
                await m.getRepository(entities_1.CommitmentEntity).remove(c);
            });
            await this.fin.log(null, { projectId: c.projectId, entityType: 'commitment', entityId: id, action: 'commitment_deleted', changes: { number: { from: c.number, to: null } } }, actor);
            return this.overview(c.projectId, actor);
        }
        else
            throw new common_1.BadRequestException('Unknown step.');
        Object.assign(c, { updatedAt: at, updatedBy: actor.name });
        await this.commitments.save(c);
        await this.fin.approval(null, { projectId: c.projectId, entityType: 'commitment', entityId: id, decision: action === 'approve' ? 'approved' : action === 'void' ? 'cancelled' : action, comment: dto.reason, amount: (0, money_1.fromCents)((0, money_1.sumCents)(lines.map((l) => (0, money_1.toCents)(l.amount)))) }, actor);
        await this.fin.log(null, { projectId: c.projectId, entityType: 'commitment', entityId: id, action: { approve: 'commitment_approved', close: 'commitment_closed', void: 'commitment_voided', reopen: 'commitment_reopened' }[action], changes: { status: { from: before, to: c.status } }, reason: dto.reason }, actor);
        return this.overview(c.projectId, actor);
    }
    async entry(id) {
        const e = await this.entries.findOneBy({ id });
        if (!e)
            throw new common_1.NotFoundException('Cost not found');
        return e;
    }
    async saveEntry(projectId, dto, actor) {
        const rights = await this.fin.need(actor, 'manageCosts');
        await this.fin.project(projectId);
        let e = dto.id ? await this.entry(dto.id) : null;
        if (e) {
            (0, financials_service_1.assertVersion)(e, dto.version);
            if (e.status === 'void')
                throw new common_1.BadRequestException('This cost is void.');
            if (e.status !== 'recorded' && !rights.approveCosts)
                throw new common_1.BadRequestException(`It's ${e.status} -- only someone who approves costs can change it.`);
        }
        const before = e ? { ...e } : null;
        e = e || this.entries.create({ id: (0, workforce_util_1.newId)('CE'), projectId, status: 'recorded', attachments: [], createdAt: now(), createdBy: actor.name });
        if (dto.date !== undefined) {
            if (!ISO.test(dto.date || ''))
                throw new common_1.BadRequestException('Give the date of the cost.');
            e.date = dto.date;
        }
        if (!e.date)
            e.date = (0, workforce_util_1.todayISO)();
        if (dto.dueDate !== undefined) {
            if (dto.dueDate && !ISO.test(dto.dueDate))
                throw new common_1.BadRequestException('The due date must be a date.');
            e.dueDate = dto.dueDate || null;
        }
        if (dto.type !== undefined) {
            if (!exports.COST_TYPES.includes(dto.type))
                throw new common_1.BadRequestException('Unknown cost type.');
            e.type = dto.type;
        }
        if (dto.amount !== undefined)
            e.amount = money(dto.amount, 'The amount');
        if (!e.amount)
            throw new common_1.BadRequestException('Give the amount.');
        for (const k of ['contractorId', 'vendorName', 'reference', 'commitmentId', 'csiCodeId', 'phaseId', 'taskId', 'description', 'notes'])
            if (dto[k] !== undefined)
                e[k] = String(dto[k] ?? '').trim() || null;
        if (!e.description)
            throw new common_1.BadRequestException('Describe the cost.');
        if (e.contractorId && !e.vendorName)
            e.vendorName = (await this.contractors.findOneBy({ id: e.contractorId }))?.companyName;
        if (e.commitmentId) {
            const c = await this.commitment(e.commitmentId);
            if (c.projectId !== projectId)
                throw new common_1.BadRequestException('That commitment is on another project.');
            if (c.status !== 'approved')
                throw new common_1.BadRequestException(`${c.number} is ${c.status} -- costs go against an approved commitment.`);
            if (!e.vendorName)
                e.vendorName = c.vendorName;
            if (!e.contractorId && c.contractorId)
                e.contractorId = c.contractorId;
            const lines = await this.commitmentLines.find({ where: { commitmentId: c.id } });
            const committedC = (0, money_1.sumCents)(lines.map((l) => (0, money_1.toCents)(l.amount)));
            const billedC = (0, money_1.sumCents)((await this.entries.find({ where: { commitmentId: c.id } })).filter((x) => x.status !== 'void' && x.id !== e.id).map((x) => (0, money_1.toCents)(x.amount)));
            if (billedC + (0, money_1.toCents)(e.amount) > committedC && !String(dto.overrideReason || '').trim()) {
                throw new common_1.BadRequestException(`This takes ${c.number} to ${fmtUsd(billedC + (0, money_1.toCents)(e.amount))} billed on a ${fmtUsd(committedC)} commitment. Revise the commitment, or give a reason to record it anyway.`);
            }
        }
        if (!e.dueDate)
            e.dueDate = addDays(e.date, 30);
        Object.assign(e, { updatedAt: now(), updatedBy: actor.name });
        await this.entries.save(e);
        await this.fin.log(null, { projectId, entityType: 'cost', entityId: e.id, action: before ? 'cost_changed' : 'cost_recorded', changes: { amount: { from: before?.amount ?? null, to: e.amount } }, reason: dto.overrideReason }, actor);
        return this.overview(projectId, actor);
    }
    async entryStep(id, action, dto, actor) {
        const e = await this.entry(id);
        (0, financials_service_1.assertVersion)(e, dto.version);
        const before = e.status;
        const at = now();
        if (action === 'approve') {
            await this.fin.need(actor, 'approveCosts');
            if (e.status !== 'recorded')
                throw new common_1.BadRequestException(`This cost is ${e.status}.`);
            Object.assign(e, { status: 'approved', approvedAt: at, approvedBy: actor.name });
        }
        else if (action === 'pay') {
            await this.fin.need(actor, 'approveCosts');
            if (e.status !== 'approved')
                throw new common_1.BadRequestException('Approve the cost before marking it paid.');
            const d = dto.paidDate || (0, workforce_util_1.todayISO)();
            if (!ISO.test(d))
                throw new common_1.BadRequestException('Give the payment date.');
            Object.assign(e, { status: 'paid', paidDate: d, paymentRef: dto.paymentRef?.trim() || null });
        }
        else if (action === 'void') {
            await this.fin.need(actor, 'approveCosts');
            if (e.status === 'void')
                throw new common_1.BadRequestException('It is already void.');
            if (!dto.reason?.trim())
                throw new common_1.BadRequestException('Say why it’s being voided.');
            Object.assign(e, { status: 'void', voidReason: dto.reason.trim() });
        }
        else if (action === 'delete') {
            await this.fin.need(actor, 'manageCosts');
            if (e.status !== 'recorded')
                throw new common_1.BadRequestException('Only an unapproved cost can be deleted -- void it instead.');
            await this.entries.remove(e);
            await this.attachments?.discardAll((0, task_types_1.normalizeAttachments)(e.attachments));
            await this.fin.log(null, { projectId: e.projectId, entityType: 'cost', entityId: id, action: 'cost_deleted', changes: { amount: { from: e.amount, to: null } } }, actor);
            return this.overview(e.projectId, actor);
        }
        else
            throw new common_1.BadRequestException('Unknown step.');
        Object.assign(e, { updatedAt: at, updatedBy: actor.name });
        await this.entries.save(e);
        await this.fin.log(null, { projectId: e.projectId, entityType: 'cost', entityId: id, action: { approve: 'cost_approved', pay: 'cost_paid', void: 'cost_voided' }[action], changes: { status: { from: before, to: e.status } }, reason: dto.reason }, actor);
        return this.overview(e.projectId, actor);
    }
    async holder(id) {
        const c = await this.commitments.findOneBy({ id });
        if (c)
            return { row: c, save: () => this.commitments.save(c) };
        const e = await this.entries.findOneBy({ id });
        if (e)
            return { row: e, save: () => this.entries.save(e) };
        throw new common_1.NotFoundException('Record not found');
    }
    async addAttachments(id, files, actor) {
        const h = await this.holder(id);
        h.row.attachments = [...(0, task_types_1.normalizeAttachments)(h.row.attachments), ...(await this.attachments.upload(files, `Project ${h.row.projectId}`, actor))];
        await h.save();
        return (0, task_types_1.normalizeAttachments)(h.row.attachments);
    }
    async addLink(id, name, url, actor) {
        const h = await this.holder(id);
        h.row.attachments = [...(0, task_types_1.normalizeAttachments)(h.row.attachments), { id: (0, task_types_1.subId)('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: now() }];
        await h.save();
        return (0, task_types_1.normalizeAttachments)(h.row.attachments);
    }
    async removeAttachment(id, attId) {
        const h = await this.holder(id);
        const all = (0, task_types_1.normalizeAttachments)(h.row.attachments);
        const target = all.find((a) => a.id === attId);
        if (!target)
            throw new common_1.NotFoundException('Attachment not found');
        await this.attachments.discard(target);
        h.row.attachments = all.filter((a) => a.id !== attId);
        await h.save();
        return h.row.attachments;
    }
    async attachment(id, attId) {
        const att = (0, task_types_1.normalizeAttachments)((await this.holder(id)).row.attachments).find((a) => a.id === attId);
        if (!att)
            throw new common_1.NotFoundException('Attachment not found');
        return att;
    }
};
exports.CostsService = CostsService;
exports.CostsService = CostsService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.CostBudgetLineEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.CommitmentEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.CommitmentLineEntity)),
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.CostEntryEntity)),
    __param(6, (0, typeorm_1.InjectRepository)(entities_1.CostForecastEntity)),
    __param(7, (0, typeorm_1.InjectRepository)(entities_1.ChangeOrderEntity)),
    __param(8, (0, typeorm_1.InjectRepository)(entities_1.ChangeOrderItemEntity)),
    __param(9, (0, typeorm_1.InjectRepository)(entities_1.ReimbursableEntity)),
    __param(10, (0, typeorm_1.InjectRepository)(entities_1.TimesheetEntity)),
    __param(11, (0, typeorm_1.InjectRepository)(entities_1.TimesheetLineEntity)),
    __param(12, (0, typeorm_1.InjectRepository)(entities_1.DailyLogEntity)),
    __param(13, (0, typeorm_1.InjectRepository)(entities_1.LaborLogEntryEntity)),
    __param(14, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __param(15, (0, typeorm_1.InjectRepository)(entities_1.CsiCodeEntity)),
    __param(16, (0, typeorm_1.InjectRepository)(entities_1.ContractorEntity)),
    __metadata("design:paramtypes", [financials_service_1.FinancialsService,
        settings_service_1.SettingsService,
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
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        attachments_service_1.AttachmentsService])
], CostsService);
function summarizeLabor(lines, burdenPct) {
    const byPerson = new Map();
    const byWeek = new Map();
    for (const l of lines) {
        const costC = (0, costs_calc_1.burdened)(l.wageC, burdenPct);
        const p = byPerson.get(l.employeeId) || { employeeId: l.employeeId, name: l.name, hours: 0, otHours: 0, wageC: 0, costC: 0, rate: l.rate };
        p.hours += l.hours;
        p.otHours += l.otHours;
        p.wageC += l.wageC;
        p.costC += costC;
        byPerson.set(l.employeeId, p);
        const d = new Date(l.date + 'T00:00:00Z');
        const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
        const w = byWeek.get(monday) || { week: monday, hours: 0, costC: 0 };
        w.hours += l.hours;
        w.costC += costC;
        byWeek.set(monday, w);
    }
    const r2 = (n) => Math.round(n * 100) / 100;
    return (0, finance_calc_1.toDollars)({
        people: Array.from(byPerson.values()).map((p) => ({ ...p, hours: r2(p.hours), otHours: r2(p.otHours) })).sort((a, b) => b.costC - a.costC),
        weeks: Array.from(byWeek.values()).map((w) => ({ ...w, hours: r2(w.hours) })).sort((a, b) => a.week.localeCompare(b.week)),
        hours: r2(lines.reduce((a, l) => a + l.hours, 0)), wageC: (0, money_1.sumCents)(lines.map((l) => l.wageC)), costC: (0, money_1.sumCents)(lines.map((l) => (0, costs_calc_1.burdened)(l.wageC, burdenPct))),
    });
}
//# sourceMappingURL=costs.service.js.map