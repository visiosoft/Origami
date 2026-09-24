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
exports.ChangeOrdersService = exports.CO_REASONS = void 0;
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
exports.CO_REASONS = ['client_request', 'design_change', 'unforeseen', 'scope_addition', 'scope_reduction', 'allowance', 'code_requirement', 'other'];
const TARGETS = ['phase', 'task', 'new_phase', 'new_task', 'none'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const now = () => new Date().toISOString();
const fmtUsd = (c) => (c < 0 ? '-$' : '$') + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let ChangeOrdersService = class ChangeOrdersService {
    constructor(cos, items, phases, tasks, projects, fin, attachments) {
        this.cos = cos;
        this.items = items;
        this.phases = phases;
        this.tasks = tasks;
        this.projects = projects;
        this.fin = fin;
        this.attachments = attachments;
    }
    async load(id) {
        const co = await this.cos.findOneBy({ id });
        if (!co)
            throw new common_1.NotFoundException('Change order not found');
        return co;
    }
    present(co, items) {
        const sorted = items.filter((i) => i.changeOrderId === co.id).sort((a, b) => a.lineOrder - b.lineOrder);
        const liveC = (0, money_1.sumCents)(sorted.map((i) => (0, money_1.toCents)(i.amount)));
        const costC = (0, money_1.sumCents)(sorted.map((i) => (0, money_1.toCents)(i.cost ?? 0)));
        return {
            ...co, attachments: (0, task_types_1.normalizeAttachments)(co.attachments), items: sorted,
            ...(0, finance_calc_1.toDollars)({ totalC: co.status === 'approved' && co.amount != null ? (0, money_1.toCents)(co.amount) : liveC, costC, marginC: liveC - costC }),
        };
    }
    async list(projectId, actor) {
        await this.fin.need(actor, 'viewChangeOrders');
        const [cos, items] = await Promise.all([this.cos.find({ where: { projectId } }), this.items.find({ where: { projectId } })]);
        return cos.map((c) => this.present(c, items)).sort((a, b) => b.number.localeCompare(a.number));
    }
    async all(actor) {
        await this.fin.need(actor, 'viewChangeOrders');
        const [cos, items, projects] = await Promise.all([this.cos.find(), this.items.find(), this.projects.find()]);
        const name = new Map(projects.map((p) => [p.id, p.name]));
        return cos.map((c) => ({ ...this.present(c, items), projectName: name.get(c.projectId) || `Project ${c.projectId}` }))
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
    async get(id, actor) {
        await this.fin.need(actor, 'viewChangeOrders');
        const co = await this.load(id);
        const items = await this.items.find({ where: { changeOrderId: id } });
        return { ...this.present(co, items), approvals: await this.fin.approvalsFor(id) };
    }
    async create(projectId, dto, actor) {
        await this.fin.need(actor, 'editChangeOrders');
        await this.fin.project(projectId);
        const { row } = await this.fin.settingsFor(projectId);
        if (!row)
            throw new common_1.BadRequestException('Set up this project’s financials (the original contract) before adding change orders.');
        const title = String(dto.title || '').trim();
        if (!title)
            throw new common_1.BadRequestException('Give the change order a title.');
        let co = null;
        for (let attempt = 0; attempt < 3 && !co; attempt++) {
            const number = await this.fin.nextProjectNumber(this.cos, projectId, 'CO');
            try {
                co = await this.cos.save(this.cos.create({
                    id: (0, workforce_util_1.newId)('CO'), projectId, number, title, status: 'draft', reason: exports.CO_REASONS.includes(dto.reason) ? dto.reason : 'client_request',
                    requestedBy: dto.requestedBy?.trim() || undefined, dateRequested: ISO.test(dto.dateRequested || '') ? dto.dateRequested : (0, workforce_util_1.todayISO)(),
                    description: dto.description?.trim() || undefined, scheduleImpactDays: Number(dto.scheduleImpactDays) || 0, attachments: [], createdAt: now(), createdBy: actor.name,
                }));
            }
            catch (e) {
                if (attempt === 2)
                    throw e;
            }
        }
        if (dto.items?.length)
            await this.saveItems(co, dto.items);
        await this.fin.log(null, { projectId, entityType: 'change_order', entityId: co.id, action: 'co_created', changes: { number: { from: null, to: co.number } } }, actor);
        return this.get(co.id, actor);
    }
    async validItems(co, dtos) {
        const [phases, tasks] = await Promise.all([this.phases.find({ where: { projectId: co.projectId } }), this.tasks.find({ where: { projectId: co.projectId } })]);
        return dtos.map((d, i) => {
            const description = String(d.description || '').trim();
            if (!description)
                throw new common_1.BadRequestException(`Item ${i + 1}: describe the change.`);
            const targetType = TARGETS.includes(d.targetType || '') ? d.targetType : 'none';
            const q = d.quantity == null || d.quantity === '' ? null : Number(d.quantity);
            const rate = d.rate == null || d.rate === '' ? null : Number(d.rate);
            const amountC = q != null && rate != null ? Math.round(q * (0, money_1.toCents)(rate)) : (0, money_1.toCents)(d.amount);
            if (!amountC)
                throw new common_1.BadRequestException(`Item ${i + 1}: give the amount (negative for a deduction).`);
            let phaseId = null;
            let taskId = null;
            if (targetType === 'phase' || targetType === 'new_task') {
                if (d.phaseId || targetType === 'phase') {
                    if (!phases.some((p) => p.id === d.phaseId))
                        throw new common_1.BadRequestException(`Item ${i + 1}: choose a milestone on this project.`);
                    phaseId = d.phaseId;
                }
            }
            if (targetType === 'task') {
                const t = tasks.find((x) => x.id === d.taskId);
                if (!t)
                    throw new common_1.BadRequestException(`Item ${i + 1}: choose a task on this project.`);
                if (t.parentId)
                    throw new common_1.BadRequestException(`Item ${i + 1}: change orders go on tasks, not subtasks.`);
                taskId = t.id;
                phaseId = t.phaseId || null;
            }
            if ((targetType === 'new_phase' || targetType === 'new_task') && !String(d.newName || '').trim())
                throw new common_1.BadRequestException(`Item ${i + 1}: name the new ${targetType === 'new_phase' ? 'milestone' : 'task'}.`);
            if ((targetType === 'new_phase' || targetType === 'new_task') && amountC < 0)
                throw new common_1.BadRequestException(`Item ${i + 1}: a new item can only add to the contract.`);
            return this.items.create({
                id: d.id && d.id.startsWith('COI') ? d.id : (0, workforce_util_1.newId)('COI'), changeOrderId: co.id, projectId: co.projectId, lineOrder: i, description, targetType,
                phaseId: phaseId, taskId: taskId, newName: targetType.startsWith('new_') ? String(d.newName).trim() : undefined,
                amount: (0, money_1.fromCents)(amountC), cost: d.cost == null || d.cost === '' ? null : (0, money_1.fromCents)((0, money_1.toCents)(d.cost)), quantity: q, unit: d.unit?.trim() || undefined,
                rate: rate == null ? null : (0, money_1.fromCents)((0, money_1.toCents)(rate)), csiCodeId: d.csiCodeId || undefined, createdAt: now(),
            });
        });
    }
    async saveItems(co, dtos) {
        const next = await this.validItems(co, dtos);
        const old = await this.items.find({ where: { changeOrderId: co.id } });
        await this.cos.manager.transaction(async (m) => {
            const gone = old.filter((o) => !next.some((n) => n.id === o.id));
            if (gone.length)
                await m.getRepository(entities_1.ChangeOrderItemEntity).remove(gone);
            if (next.length)
                await m.getRepository(entities_1.ChangeOrderItemEntity).save(next, { chunk: 40 });
        });
    }
    async update(id, dto, actor) {
        await this.fin.need(actor, 'editChangeOrders');
        const co = await this.load(id);
        if (co.status !== 'draft')
            throw new common_1.BadRequestException('Only a draft change order can be edited -- return it to draft first.');
        (0, financials_service_1.assertVersion)(co, dto.version);
        const before = { ...co };
        if (dto.title !== undefined) {
            const t = String(dto.title || '').trim();
            if (!t)
                throw new common_1.BadRequestException('Give the change order a title.');
            co.title = t;
        }
        if (dto.reason !== undefined) {
            if (!exports.CO_REASONS.includes(dto.reason))
                throw new common_1.BadRequestException('Unknown reason.');
            co.reason = dto.reason;
        }
        if (dto.dateRequested !== undefined) {
            if (dto.dateRequested && !ISO.test(dto.dateRequested))
                throw new common_1.BadRequestException('The request date must be a date.');
            co.dateRequested = dto.dateRequested || null;
        }
        if (dto.scheduleImpactDays !== undefined) {
            const n = Number(dto.scheduleImpactDays);
            if (!Number.isInteger(n) || Math.abs(n) > 3650)
                throw new common_1.BadRequestException('Schedule impact is a whole number of days.');
            co.scheduleImpactDays = n;
        }
        for (const k of ['description', 'requestedBy', 'notes'])
            if (dto[k] !== undefined)
                co[k] = String(dto[k] ?? '').trim() || null;
        Object.assign(co, { updatedAt: now(), updatedBy: actor.name });
        if (dto.items)
            await this.saveItems(co, dto.items);
        await this.cos.save(co);
        const changes = {};
        for (const k of ['title', 'reason', 'scheduleImpactDays'])
            if (String(before[k] ?? '') !== String(co[k] ?? ''))
                changes[k] = { from: before[k] ?? null, to: co[k] ?? null };
        if (dto.items)
            changes.items = { from: null, to: dto.items.length };
        await this.fin.log(null, { projectId: co.projectId, entityType: 'change_order', entityId: id, action: 'co_changed', changes }, actor);
        return this.get(id, actor);
    }
    async remove(id, actor) {
        await this.fin.need(actor, 'editChangeOrders');
        const co = await this.load(id);
        if (co.status !== 'draft' || co.submittedAt)
            throw new common_1.BadRequestException('Only a draft that was never submitted can be deleted -- cancel it instead, so the number stays accounted for.');
        await this.cos.manager.transaction(async (m) => {
            await m.getRepository(entities_1.ChangeOrderItemEntity).delete({ changeOrderId: id });
            await m.getRepository(entities_1.ChangeOrderEntity).remove(co);
        });
        await this.attachments?.discardAll((0, task_types_1.normalizeAttachments)(co.attachments));
        await this.fin.log(null, { projectId: co.projectId, entityType: 'change_order', entityId: id, action: 'co_deleted', changes: { number: { from: co.number, to: null } } }, actor);
        return { id, deleted: true };
    }
    async act(id, action, dto, actor) {
        const co = await this.load(id);
        (0, financials_service_1.assertVersion)(co, dto.version);
        const at = now();
        const before = co.status;
        const comment = String(dto.comment || dto.reason || '').trim();
        const step = async (decision, patch, logAction, reason) => {
            Object.assign(co, patch, { updatedAt: at, updatedBy: actor.name });
            await this.cos.save(co);
            await this.fin.approval(null, { projectId: co.projectId, entityType: 'change_order', entityId: id, decision, comment }, actor);
            await this.fin.log(null, { projectId: co.projectId, entityType: 'change_order', entityId: id, action: logAction, changes: { status: { from: before, to: co.status } }, reason }, actor);
            return this.get(id, actor);
        };
        const need = (...from) => { if (!from.includes(co.status))
            throw new common_1.BadRequestException(`This change order is ${co.status.replace('_', ' ')} -- that step doesn't apply.`); };
        switch (action) {
            case 'submit': {
                await this.fin.need(actor, 'editChangeOrders');
                need('draft');
                if (!(await this.items.count({ where: { changeOrderId: id } })))
                    throw new common_1.BadRequestException('Price at least one item before submitting.');
                return step('submitted', { status: 'internal_review', submittedAt: at, submittedBy: actor.name }, 'co_submitted');
            }
            case 'approve_internal': {
                await this.fin.need(actor, 'approveChangeOrders');
                need('internal_review');
                await this.check(co);
                return step('internal_approved', { status: 'submitted', internalApprovedAt: at, internalApprovedBy: actor.name }, 'co_sent_to_client');
            }
            case 'return': {
                await this.fin.need(actor, 'approveChangeOrders');
                need('internal_review', 'submitted');
                if (!comment)
                    throw new common_1.BadRequestException('Say what needs changing.');
                return step('returned', { status: 'draft' }, 'co_returned', comment);
            }
            case 'client_approve': {
                await this.fin.need(actor, 'approveChangeOrders');
                need('draft', 'submitted', 'internal_review');
                const signer = String(dto.signer || '').trim();
                const date = String(dto.date || '').trim() || (0, workforce_util_1.todayISO)();
                if (!signer)
                    throw new common_1.BadRequestException('Record who approved it for the client.');
                if (!ISO.test(date))
                    throw new common_1.BadRequestException('Give the date the client approved it.');
                return this.approve(co, { signer, date, reference: String(dto.reference || '').trim(), comment }, actor);
            }
            case 'reject': {
                await this.fin.need(actor, 'approveChangeOrders');
                need('internal_review', 'submitted');
                if (!comment)
                    throw new common_1.BadRequestException('Say why it was rejected.');
                return step('rejected', { status: 'rejected', rejectedAt: at, rejectedBy: actor.name, closedReason: comment }, 'co_rejected', comment);
            }
            case 'cancel': {
                await this.fin.need(actor, 'editChangeOrders');
                need('draft', 'internal_review', 'submitted');
                if (!comment)
                    throw new common_1.BadRequestException('Say why it’s being cancelled.');
                return step('cancelled', { status: 'cancelled', cancelledAt: at, cancelledBy: actor.name, closedReason: comment }, 'co_cancelled', comment);
            }
            case 'reopen': {
                await this.fin.need(actor, 'editChangeOrders');
                need('rejected');
                return step('reopened', { status: 'draft', closedReason: null }, 'co_reopened');
            }
            default: throw new common_1.BadRequestException('Unknown step.');
        }
    }
    async check(co) {
        const items = (await this.items.find({ where: { changeOrderId: co.id } })).sort((a, b) => a.lineOrder - b.lineOrder);
        if (!items.length)
            throw new common_1.BadRequestException('This change order has no items.');
        const ctx = await this.fin.context(co.projectId);
        const input = ctx.input;
        const adjust = new Map(input.coAdjust || []);
        const phases = [...input.phases];
        const tasks = [...input.tasks];
        const keyFor = new Map();
        items.forEach((it, i) => {
            let key = null;
            if (it.targetType === 'phase') {
                if (!phases.some((p) => p.id === it.phaseId))
                    throw new common_1.BadRequestException(`Item ${i + 1}: its milestone no longer exists.`);
                key = `phase:${it.phaseId}`;
            }
            else if (it.targetType === 'task') {
                if (!tasks.some((t) => t.id === it.taskId))
                    throw new common_1.BadRequestException(`Item ${i + 1}: its task no longer exists.`);
                key = `task:${it.taskId}`;
            }
            else if (it.targetType === 'new_phase') {
                const id = `NEW-PH-${i}`;
                phases.push({ id, key: `new-${i}`, name: it.newName, order: 9999 + i, category: 'other' });
                key = `phase:${id}`;
            }
            else if (it.targetType === 'new_task') {
                if (it.phaseId && !phases.some((p) => p.id === it.phaseId))
                    throw new common_1.BadRequestException(`Item ${i + 1}: its milestone no longer exists.`);
                const id = `NEW-T-${i}`;
                tasks.push({ id, title: it.newName, phaseId: it.phaseId || null, done: false, order: 9999 + i });
                key = `task:${id}`;
            }
            if (key) {
                adjust.set(key, (adjust.get(key) || 0) + (0, money_1.toCents)(it.amount));
                keyFor.set(it.id, key);
            }
        });
        const totalC = (0, money_1.sumCents)(items.map((i) => (0, money_1.toCents)(i.amount)));
        const before = (0, finance_calc_1.computeSov)(input);
        const after = (0, finance_calc_1.computeSov)({ ...input, phases, tasks, coAdjust: adjust, approvedChangesC: input.approvedChangesC + totalC });
        const flatRows = (sov) => sov.groups.flatMap((g) => g.rows.flatMap((r) => [r, ...(r.children || [])]));
        const rows = flatRows(after);
        const beforeRows = flatRows(before);
        const find = (key) => rows.find((r) => `${r.kind}:${r.id}` === key);
        items.forEach((it, i) => {
            const key = keyFor.get(it.id);
            if (!key)
                return;
            const row = find(key);
            if (!row)
                return;
            if (row.kind === 'phase' && row.valueFromTasks)
                throw new common_1.BadRequestException(`Item ${i + 1}: ${row.name}'s value comes from its tasks -- put the change on a task.`);
            if (row.kind === 'task' && row.phaseId) {
                const parentBefore = beforeRows.find((r) => r.kind === 'phase' && r.id === row.phaseId);
                if (parentBefore && !parentBefore.valueFromTasks && parentBefore.valueC != null) {
                    throw new common_1.BadRequestException(`Item ${i + 1}: ${parentBefore.name} carries its own value -- put the change on the milestone instead of one of its tasks.`);
                }
            }
            if ((row.valueC ?? 0) < row.invoicedC)
                throw new common_1.BadRequestException(`Item ${i + 1}: ${row.name} would be worth ${fmtUsd(row.valueC ?? 0)} but ${fmtUsd(row.invoicedC)} is already invoiced on it.`);
            if ((row.valueC ?? 0) < 0)
                throw new common_1.BadRequestException(`Item ${i + 1}: ${row.name} can't be worth less than nothing.`);
        });
        const s = after.summary;
        if (s.revisedContractC < s.contractWorkInvoicedC)
            throw new common_1.BadRequestException(`The contract would drop to ${fmtUsd(s.revisedContractC)}, below the ${fmtUsd(s.contractWorkInvoicedC)} of work already invoiced.`);
        if (s.revisedContractC < 0)
            throw new common_1.BadRequestException('The contract can’t go below zero.');
        if (!s.lumpSum && s.allocatedC > s.revisedContractC)
            throw new common_1.BadRequestException(`Allocated values would total ${fmtUsd(s.allocatedC)} against a ${fmtUsd(s.revisedContractC)} contract. Lower item values or add the difference to the change order.`);
        return { totalC, before: before.summary, after: s };
    }
    async impact(id, actor) {
        await this.fin.need(actor, 'viewChangeOrders');
        const co = await this.load(id);
        try {
            const r = await this.check(co);
            return (0, finance_calc_1.toDollars)({ ok: true, totalC: r.totalC, revisedBeforeC: r.before.revisedContractC, revisedAfterC: r.after.revisedContractC, unallocatedAfterC: r.after.unallocatedC });
        }
        catch (e) {
            return { ok: false, problem: e?.message || 'This change order can’t be approved as it stands.' };
        }
    }
    async approve(co, c, actor) {
        const { totalC } = await this.check(co);
        const items = (await this.items.find({ where: { changeOrderId: co.id } })).sort((a, b) => a.lineOrder - b.lineOrder);
        const at = now();
        const before = co.status;
        await this.cos.manager.transaction(async (m) => {
            const fresh = await m.getRepository(entities_1.ChangeOrderEntity).findOne({ where: { id: co.id }, lock: { mode: 'pessimistic_write' } });
            if (!fresh || fresh.status !== before)
                throw new common_1.BadRequestException('This change order changed meanwhile -- reload it.');
            const phaseRepo = m.getRepository(entities_1.ProjectPhaseEntity);
            const taskRepo = m.getRepository(entities_1.ProjectTaskEntity);
            const existing = await phaseRepo.find({ where: { projectId: co.projectId } });
            let order = existing.reduce((mx, p) => Math.max(mx, p.order), -1);
            const sections = (await m.getRepository(entities_1.ProjectSectionEntity).find({ where: { projectId: co.projectId } })).sort((a, b) => a.order - b.order);
            const sectionId = sections[0]?.id ?? `S-${co.projectId}-0`;
            for (const [i, it] of items.entries()) {
                if (it.targetType === 'new_phase') {
                    const key = `fin-${Date.now().toString(36)}${i}`;
                    const ph = await phaseRepo.save(phaseRepo.create({ id: `PH-${co.projectId}-${key}`, projectId: co.projectId, key, name: it.newName, color: '#7E9B93', order: ++order }));
                    it.phaseId = ph.id;
                }
                else if (it.targetType === 'new_task') {
                    const siblings = await taskRepo.find({ where: { projectId: co.projectId } });
                    const t = await taskRepo.save(taskRepo.create({
                        id: `T-${co.projectId}-co${Date.now().toString(36)}${i}`, projectId: co.projectId, sectionId, phaseId: it.phaseId || undefined, title: it.newName,
                        description: `Added by ${co.number}: ${co.title}`, status: 'Not started', completed: false, order: siblings.length + i,
                        attachments: [], comments: [], checklist: [], labels: [], activity: [], createdAt: at.slice(0, 10), updatedAt: at,
                    }));
                    it.taskId = t.id;
                }
            }
            await m.getRepository(entities_1.ChangeOrderItemEntity).save(items, { chunk: 40 });
            Object.assign(fresh, {
                status: 'approved', amount: (0, money_1.fromCents)(totalC), approvedAt: at, approvedBy: actor.name, clientSigner: c.signer, clientApprovedDate: c.date,
                clientReference: c.reference || null, updatedAt: at, updatedBy: actor.name,
                ...(fresh.internalApprovedAt ? {} : { internalApprovedAt: at, internalApprovedBy: actor.name }),
                ...(fresh.submittedAt ? {} : { submittedAt: at, submittedBy: actor.name }),
            });
            await m.getRepository(entities_1.ChangeOrderEntity).save(fresh);
            await this.fin.approval(m, { projectId: co.projectId, entityType: 'change_order', entityId: co.id, decision: 'client_approved', signer: c.signer, amount: (0, money_1.fromCents)(totalC), comment: [c.reference, c.comment].filter(Boolean).join(' · ') }, actor);
            await this.fin.log(m, { projectId: co.projectId, entityType: 'change_order', entityId: co.id, action: 'co_approved', changes: { status: { from: before, to: 'approved' }, amount: { from: null, to: (0, money_1.fromCents)(totalC) } } }, actor);
        });
        return this.get(co.id, actor);
    }
    async addAttachments(id, files, actor) {
        const co = await this.load(id);
        const added = await this.attachments.upload(files, `Project ${co.projectId}`, actor);
        co.attachments = [...(0, task_types_1.normalizeAttachments)(co.attachments), ...added];
        await this.cos.save(co);
        return (0, task_types_1.normalizeAttachments)(co.attachments);
    }
    async addLink(id, name, url, actor) {
        const co = await this.load(id);
        const att = { id: (0, task_types_1.subId)('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: now() };
        co.attachments = [...(0, task_types_1.normalizeAttachments)(co.attachments), att];
        await this.cos.save(co);
        return (0, task_types_1.normalizeAttachments)(co.attachments);
    }
    async removeAttachment(id, attId) {
        const co = await this.load(id);
        const all = (0, task_types_1.normalizeAttachments)(co.attachments);
        const target = all.find((a) => a.id === attId);
        if (!target)
            throw new common_1.NotFoundException('Attachment not found');
        await this.attachments.discard(target);
        co.attachments = all.filter((a) => a.id !== attId);
        await this.cos.save(co);
        return co.attachments;
    }
    async attachment(id, attId) {
        const att = (0, task_types_1.normalizeAttachments)((await this.load(id)).attachments).find((a) => a.id === attId);
        if (!att)
            throw new common_1.NotFoundException('Attachment not found');
        return att;
    }
};
exports.ChangeOrdersService = ChangeOrdersService;
exports.ChangeOrdersService = ChangeOrdersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ChangeOrderEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ChangeOrderItemEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.ProjectPhaseEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.ProjectTaskEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        financials_service_1.FinancialsService,
        attachments_service_1.AttachmentsService])
], ChangeOrdersService);
//# sourceMappingURL=change-orders.service.js.map