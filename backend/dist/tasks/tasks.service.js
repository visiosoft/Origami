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
exports.TasksService = exports.LOG_ARCHIVE_DAYS = void 0;
exports.cleanIds = cleanIds;
exports.taskTitle = taskTitle;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const settings_service_1 = require("../settings/settings.service");
const auto_checklist_1 = require("../project-tasks/auto-checklist");
const serials_1 = require("../database/serials");
const log_statuses_1 = require("./log-statuses");
exports.LOG_ARCHIVE_DAYS = 7;
const entities_1 = require("../database/entities");
const lead_link_1 = require("./lead-link");
const pending_notices_1 = require("../notifications/pending-notices");
const task_types_1 = require("../database/task.types");
const assignee_util_1 = require("../database/assignee.util");
const notifications_service_1 = require("../notifications/notifications.service");
const attachments_service_1 = require("../google/attachments.service");
const SCOPE = 'Request Log';
let TasksService = class TasksService {
    constructor(repo, users, attachments, notifications, settings, cos, checklistTemplates, leads, deals, projects) {
        this.repo = repo;
        this.users = users;
        this.attachments = attachments;
        this.notifications = notifications;
        this.settings = settings;
        this.cos = cos;
        this.checklistTemplates = checklistTemplates;
        this.leads = leads;
        this.deals = deals;
        this.projects = projects;
        this.log = new common_1.Logger('TasksService');
    }
    async statuses() {
        if (!this.settings)
            return log_statuses_1.DEFAULT_LOG_STATUSES;
        return (0, log_statuses_1.parseLogStatuses)(await this.settings.get(log_statuses_1.LOG_STATUSES_KEY).catch(() => null));
    }
    async saveStatuses(list) {
        const clean = (0, log_statuses_1.parseLogStatuses)(list);
        await this.settings.set(log_statuses_1.LOG_STATUSES_KEY, JSON.stringify(clean));
        return clean;
    }
    async onApplicationBootstrap() {
        const tick = setInterval(() => { this.flushOverdue().catch((e) => this.log.warn('Held task emails: ' + e.message)); }, 60_000);
        tick.unref?.();
        try {
            await (0, assignee_util_1.backfillAssignees)(this.repo, this.users, 'assignedToId', 'assignedTo', this.log);
        }
        catch (err) {
            this.log.error('Assignee backfill failed: ' + err.message);
        }
        try {
            const n = await this.moveToBuckets();
            if (n)
                this.log.log(`Moved ${n} Request Log entries onto the task buckets`);
        }
        catch (err) {
            this.log.error('Request Log bucket move failed: ' + err.message);
        }
        try {
            const n = await this.linkLeads();
            if (n)
                this.log.log(`Linked ${n} Request Log entries to their lead`);
        }
        catch (err) {
            this.log.error('Request Log lead links failed: ' + err.message);
        }
        try {
            const n = await this.numberUnnumbered();
            if (n)
                this.log.log(`Gave ${n} Request Log entries a serial number`);
        }
        catch (err) {
            this.log.error('Request Log serial numbers failed: ' + err.message);
        }
    }
    async linkLeads() {
        if (!this.deals || !this.leads)
            return 0;
        const dealIds = new Set((await this.deals.find({ select: { id: true } })).map((d) => d.id));
        const rows = (await this.repo.find()).filter((t) => t.project && dealIds.has(t.project) && !t.leadId);
        if (!rows.length)
            return 0;
        const leads = new Map((await this.leads.find()).map((l) => [l.id, (0, lead_link_1.leadDisplayName)(l)]));
        const converted = new Map(((await this.projects?.find()) || []).filter((p) => p.leadId && p.stage !== 'Kickoff').map((p) => [p.leadId, p.name]));
        for (const t of rows)
            await this.repo.update({ id: t.id }, { leadId: t.project, leadName: leads.get(t.project) || '', project: converted.get(t.project) || '' });
        return rows.length;
    }
    async linkTargets() {
        const projects = ((await this.projects?.find()) || []);
        const deals = this.deals ? (await this.deals.find()).filter((d) => !d.archived && !d.convertedProjectId) : [];
        const leads = new Map(((await this.leads?.find()) || []).map((l) => [l.id, (0, lead_link_1.leadDisplayName)(l)]));
        return {
            projects: projects.filter((p) => !(p.leadId && p.stage === 'Kickoff')).map((p) => ({ id: p.id, name: p.name, stage: p.stage })).sort((a, b) => a.name.localeCompare(b.name)),
            leads: deals.map((d) => ({ id: d.id, name: leads.get(d.id) || d.id, stage: d.stage })).sort((a, b) => a.name.localeCompare(b.name)),
        };
    }
    async adoptLead(leadId, projectName) {
        const rows = await this.repo.findBy({ leadId });
        for (const t of rows.filter((x) => !x.project))
            await this.repo.update({ id: t.id }, { project: projectName });
        return rows.length;
    }
    async leadFields(dto) {
        const out = {};
        if (dto.project !== undefined && (await (0, lead_link_1.isLeadId)(this.deals, dto.project))) {
            out.leadId = dto.project;
            out.project = '';
        }
        else if (dto.leadId === undefined)
            return out;
        Object.assign(out, await (0, lead_link_1.resolveLead)(this.leads, out.leadId ?? dto.leadId));
        return out;
    }
    async numberUnnumbered() {
        const rows = await this.repo.find();
        if (!rows.some((t) => !t.serial))
            return 0;
        const made = (t) => (/^\d{8}-/.test(t.id) ? `${t.id.slice(0, 4)}-${t.id.slice(4, 6)}-${t.id.slice(6, 8)}` : t.meetingDate);
        const pairs = (0, serials_1.backfillSerials)(rows, (t) => (0, serials_1.logSerialKind)(t.topicType) + '|' + (t.project || ''), (t) => (0, serials_1.logSerialKind)(t.topicType), made);
        for (const [id, serial] of pairs)
            await this.repo.update({ id }, { serial });
        return pairs.length;
    }
    async moveToBuckets() {
        if (!this.settings || (await this.settings.get('requestLog.bucketsV1')))
            return 0;
        const saved = await this.settings.get(log_statuses_1.LOG_STATUSES_KEY).catch(() => null);
        if (saved)
            await this.settings.set(log_statuses_1.LOG_STATUSES_KEY, JSON.stringify((0, log_statuses_1.withBuckets)((0, log_statuses_1.parseLogStatuses)(saved))));
        let n = 0;
        for (const t of await this.repo.find()) {
            const next = (0, log_statuses_1.bucketOf)(t.status, !!(t.assignedToId || String(t.assignedTo || '').trim()));
            if (next && next !== t.status) {
                await this.repo.update({ id: t.id }, { status: next });
                n++;
            }
        }
        await this.settings.set('requestLog.bucketsV1', new Date().toISOString());
        return n;
    }
    async isAdmin(actor) {
        if (!actor.id)
            return false;
        return (await this.users.findOneBy({ id: actor.id }))?.roleKey === 'admin';
    }
    raisedBy(t) {
        const created = (0, task_types_1.normalizeList)(t.activity).find((e) => e.type === 'created');
        return { id: created?.byId, name: String(t.originator || created?.by || '').trim() };
    }
    async bucketRules(task, patch, actor) {
        const assigned = 'assignedTo' in patch || 'assignedToId' in patch
            ? !!(patch.assignedToId || String(patch.assignedTo || '').trim())
            : !!(task.assignedToId || String(task.assignedTo || '').trim());
        if (patch.status)
            patch.status = (0, log_statuses_1.bucketOf)(patch.status, assigned);
        const cur = patch.status ?? task.status;
        if (cur === 'To Do' && assigned)
            patch.status = 'Assigned';
        if (cur === 'Assigned' && !assigned)
            patch.status = 'To Do';
        const next = patch.status ?? task.status;
        if (next === 'Confirmed' && task.status !== 'Confirmed') {
            const by = this.raisedBy(task);
            const mine = (by.id && by.id === actor.id) || (!by.id && by.name && by.name.toLowerCase() === String(actor.name || '').toLowerCase());
            if ((by.id || by.name) && !mine && !(await this.isAdmin(actor))) {
                throw new common_1.BadRequestException(`Only ${by.name || 'whoever raised it'} (or an admin) can confirm this.`);
            }
            patch.confirmedAt = new Date().toISOString();
        }
        else if (next !== 'Confirmed' && (task.confirmedAt || task.archivedAt)) {
            patch.confirmedAt = null;
            patch.archivedAt = null;
        }
    }
    async archiveConfirmed(rows) {
        const cutoff = new Date(Date.now() - exports.LOG_ARCHIVE_DAYS * 86400000).toISOString();
        const now = new Date().toISOString();
        for (const t of rows) {
            if (t.status === 'Confirmed' && t.confirmedAt && !t.archivedAt && t.confirmedAt <= cutoff && (!t.updatedAt || t.updatedAt <= cutoff)) {
                t.archivedAt = now;
                await this.repo.update({ id: t.id }, { archivedAt: now });
            }
        }
        return rows;
    }
    hydrate(task) {
        return {
            ...task,
            attachments: (0, task_types_1.normalizeAttachments)(task.attachments),
            comments: (0, task_types_1.normalizeList)(task.comments),
            activity: (0, task_types_1.normalizeList)(task.activity),
            checklist: (0, task_types_1.normalizeList)(task.checklist),
            labels: (0, task_types_1.normalizeList)(task.labels),
            linkedTaskIds: (0, task_types_1.normalizeList)(task.linkedTaskIds),
            changeOrderIds: (0, task_types_1.normalizeList)(task.changeOrderIds),
        };
    }
    async findAll(tab, project) {
        const where = {};
        if (tab)
            where.tab = tab;
        const rows = await this.archiveConfirmed(await this.repo.find({ where: project ? [{ ...where, project }, { ...where, leadId: project }] : where }));
        return rows.map((t) => this.hydrate(t));
    }
    async findOne(id) {
        const task = await this.repo.findOneBy({ id });
        if (!task)
            throw new common_1.NotFoundException(`Task ${id} not found`);
        return this.hydrate(task);
    }
    async load(id) {
        const task = await this.repo.findOneBy({ id });
        if (!task)
            throw new common_1.NotFoundException(`Task ${id} not found`);
        return task;
    }
    daysOpen(task) {
        const iso = /^\d{4}-\d{2}-\d{2}/;
        const current = task.daysOpen ?? 0;
        if (!iso.test(task.meetingDate ?? ''))
            return current;
        const start = Date.parse(task.meetingDate);
        if (Number.isNaN(start))
            return current;
        const end = task.dateClosed && iso.test(task.dateClosed) ? Date.parse(task.dateClosed) : Date.now();
        if (Number.isNaN(end))
            return current;
        return Math.max(0, Math.round((end - start) / 86400000));
    }
    async create(dto, actor) {
        const rows = await this.repo.find();
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const seq = rows
            .filter((t) => String(t.id).startsWith(dateStr + '-'))
            .reduce((max, t) => Math.max(max, parseInt(String(t.id).split('-')[1], 10) || 0), 0) + 1;
        const id = dto.id || `${dateStr}-${String(seq).padStart(2, '0')}`;
        if (!String(dto.subject || '').trim() && !String(dto.description || '').trim())
            throw new common_1.BadRequestException('Give the task a subject.');
        dto = { ...dto, ...(await this.leadFields(dto)) };
        const defer = !!dto.deferNotify;
        delete dto.deferNotify;
        delete dto.pendingNotices;
        const assignee = await (0, assignee_util_1.resolveAssignee)(this.users, { id: dto.assignedToId, name: dto.assignedTo });
        const templates = this.checklistTemplates ? await this.checklistTemplates.find().catch(() => []) : [];
        const checklist = (0, auto_checklist_1.withAutoChecklists)(templates, { kind: (0, serials_1.logSerialKind)(dto.topicType || 'Task'), type: dto.topicType || 'Task', labels: (0, task_types_1.normalizeList)(dto.labels) }, (0, task_types_1.normalizeList)(dto.checklist));
        const task = this.repo.create({
            tab: 'internal',
            meetingType: 'Internal',
            meetingDate: new Date().toISOString().slice(0, 10),
            status: 'To Do',
            topicType: 'Task',
            description: '',
            project: '',
            daysOpen: 0,
            ...dto,
            id,
            originator: String(dto.originator || '').trim() || actor.name || '',
            assignedTo: assignee.name,
            assignedToId: assignee.id ?? undefined,
            attachments: [],
            comments: [],
            checklist,
            labels: (0, task_types_1.normalizeList)(dto.labels),
            priority: (0, task_types_1.cleanPriority)(dto.priority),
            linkedTaskIds: cleanIds(dto.linkedTaskIds),
            changeOrderIds: cleanIds(dto.changeOrderIds),
            collaborators: (0, task_types_1.normalizeCollaborators)(dto.collaborators, assignee.id),
            activity: [(0, task_types_1.event)('created', actor, { text: 'created this task' })],
            updatedAt: new Date().toISOString(),
        });
        task.status = (0, log_statuses_1.bucketOf)(task.status || 'To Do', !!(task.assignedToId || String(task.assignedTo || '').trim())) || 'To Do';
        if (task.status === 'To Do' && (task.assignedToId || String(task.assignedTo || '').trim()))
            task.status = 'Assigned';
        task.serial = (0, serials_1.nextSerial)(rows.filter((r) => (r.project || '') === (task.project || '')).map((r) => r.serial), (0, serials_1.logSerialKind)(task.topicType), (0, serials_1.serialYear)());
        const at = new Date().toISOString();
        const who = { id: actor.id, name: actor.name };
        const followers = (0, task_types_1.normalizeCollaborators)(task.collaborators);
        const notices = [
            ...(assignee.id ? [{ kind: 'assigned', ids: [String(assignee.id)], actor: who, at }] : []),
            ...(followers.length ? [{ kind: 'added', ids: followers.map((c) => c.id), actor: who, at }] : []),
        ];
        if (defer)
            task.pendingNotices = (0, pending_notices_1.holdNotices)(null, notices);
        const saved = await this.repo.save(task);
        if (!defer)
            this.sendNotices(saved, notices);
        return this.hydrate(saved);
    }
    notice(t, actor) {
        return { surface: 'log', taskId: t.id, title: taskTitle(t), description: t.subject ? t.description || undefined : undefined, projectName: t.project, dueDate: t.dueDate, priority: t.topicType, status: t.status, actor };
    }
    async update(id, dto, actor) {
        const task = await this.load(id);
        const patch = { ...dto };
        delete patch.id;
        delete patch.serial;
        delete patch.pendingNotices;
        const defer = !!patch.deferNotify;
        delete patch.deferNotify;
        Object.assign(patch, await this.leadFields(patch));
        if ('assignedTo' in patch || 'assignedToId' in patch) {
            const assignee = await (0, assignee_util_1.resolveAssignee)(this.users, {
                id: patch.assignedToId,
                name: patch.assignedTo,
            });
            patch.assignedTo = assignee.name;
            patch.assignedToId = assignee.id ?? null;
        }
        await this.bucketRules(task, patch, actor);
        if ('priority' in patch)
            patch.priority = (0, task_types_1.cleanPriority)(patch.priority);
        const statuses = await this.statuses();
        if (patch.status && /^(blocked|on[\s-]*hold)$/i.test(String(patch.status)))
            patch.status = statuses.find((s) => /^on[\s-]*hold$/i.test(s.name))?.name || patch.status;
        const closing = !!patch.status && (0, log_statuses_1.isClosedStatus)(statuses, patch.status);
        const wasClosed = (0, log_statuses_1.isClosedStatus)(statuses, task.status);
        if (closing && !wasClosed && !patch.dateClosed) {
            patch.dateClosed = new Date().toISOString().slice(0, 10);
        }
        if (patch.status && !closing)
            patch.dateClosed = '';
        for (const k of ['linkedTaskIds', 'changeOrderIds'])
            if (k in patch)
                patch[k] = cleanIds(patch[k]);
        let joined = [];
        const collabEvents = [];
        if ('collaborators' in patch) {
            patch.collaborators = (0, task_types_1.normalizeCollaborators)(patch.collaborators, patch.assignedToId ?? task.assignedToId);
            const { added, removed } = (0, task_types_1.collaboratorChanges)(task.collaborators, patch.collaborators);
            joined = added;
            if (added.length)
                collabEvents.push((0, task_types_1.event)('collaborators', actor, { text: `added ${added.map((c) => c.name).join(', ')} as collaborator${added.length === 1 ? '' : 's'}` }));
            if (removed.length)
                collabEvents.push((0, task_types_1.event)('collaborators', actor, { text: `removed ${removed.map((c) => c.name).join(', ')} from collaborators` }));
        }
        const finished = closing && !wasClosed;
        const events = [...(0, task_types_1.diffEvents)(task, patch, actor), ...collabEvents];
        const reassignedTo = 'assignedToId' in patch && patch.assignedToId && patch.assignedToId !== task.assignedToId
            ? String(patch.assignedToId)
            : null;
        if ((patch.status ?? task.status) !== 'On hold' && task.holdReason)
            patch.holdReason = null;
        const at = new Date().toISOString();
        const who = { id: actor.id, name: actor.name };
        const notices = [
            ...(reassignedTo ? [{ kind: 'assigned', ids: [reassignedTo], actor: who, at }] : []),
            ...(joined.length ? [{ kind: 'added', ids: joined.map((c) => c.id), actor: who, at }] : []),
            ...(finished ? [{ kind: 'done', ids: [], actor: who, at }] : []),
        ];
        Object.assign(task, patch, { id });
        task.activity = [...(0, task_types_1.normalizeList)(task.activity), ...events];
        task.daysOpen = this.daysOpen(task);
        task.updatedAt = new Date().toISOString();
        if (defer && notices.length)
            task.pendingNotices = (0, pending_notices_1.holdNotices)(task.pendingNotices, notices);
        const saved = await this.repo.save(task);
        if (!defer)
            this.sendNotices(saved, notices);
        return this.hydrate(saved);
    }
    sendNotices(t, notices) {
        for (const n of notices) {
            const notice = this.notice(t, n.actor);
            if (n.kind === 'assigned')
                this.notifications.taskAssigned({ ...notice, assigneeId: n.ids[0] });
            else if (n.kind === 'added')
                this.notifications.taskFollowUp(notice, n.ids, { kind: 'added' });
            else
                this.notifications.taskFollowUp(notice, (0, task_types_1.normalizeCollaborators)(t.collaborators).map((c) => c.id), { kind: 'done' });
        }
    }
    async flushNotices(id) {
        const t = await this.repo.findOneBy({ id });
        if (!t?.pendingNotices?.length)
            return { sent: 0 };
        const closed = new Set((await this.statuses()).filter((s) => s.closed).map((s) => s.name));
        const live = (0, pending_notices_1.stillTrue)(t.pendingNotices, { assigneeId: t.assignedToId, collaboratorIds: (0, task_types_1.normalizeCollaborators)(t.collaborators).map((c) => c.id), done: closed.has(t.status) });
        await this.repo.update({ id }, { pendingNotices: null });
        this.sendNotices(t, live);
        return { sent: live.length };
    }
    async flushOverdue() {
        for (const t of (await this.repo.find()).filter((x) => (0, pending_notices_1.overdue)(x.pendingNotices)))
            await this.flushNotices(t.id);
    }
    async remove(id) {
        const task = await this.repo.findOneBy({ id });
        if (task) {
            await this.attachments.discardAll((0, task_types_1.normalizeAttachments)(task.attachments));
            await this.repo.remove(task);
        }
        return { id, deleted: true };
    }
    async addAttachments(id, files, actor) {
        const task = await this.load(id);
        const added = await this.attachments.upload(files, SCOPE, actor);
        task.attachments = [...(0, task_types_1.normalizeAttachments)(task.attachments), ...added];
        task.activity = [
            ...(0, task_types_1.normalizeList)(task.activity),
            ...added.map((a) => (0, task_types_1.event)('attachment', actor, { text: `attached ${a.name}` })),
        ];
        task.updatedAt = new Date().toISOString();
        return this.hydrate(await this.repo.save(task));
    }
    async addLink(id, name, url, actor) {
        const task = await this.load(id);
        const att = { id: (0, task_types_1.subId)('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: new Date().toISOString() };
        task.attachments = [...(0, task_types_1.normalizeAttachments)(task.attachments), att];
        task.activity = [...(0, task_types_1.normalizeList)(task.activity), (0, task_types_1.event)('attachment', actor, { text: `linked ${att.name}` })];
        return this.hydrate(await this.repo.save(task));
    }
    async removeAttachment(id, attId, actor) {
        const task = await this.load(id);
        const all = (0, task_types_1.normalizeAttachments)(task.attachments);
        const target = all.find((a) => a.id === attId);
        if (!target)
            throw new common_1.NotFoundException('Attachment not found');
        await this.attachments.discard(target);
        task.attachments = all.filter((a) => a.id !== attId);
        task.activity = [...(0, task_types_1.normalizeList)(task.activity), (0, task_types_1.event)('attachment', actor, { text: `removed ${target.name}` })];
        return this.hydrate(await this.repo.save(task));
    }
    async attachment(id, attId) {
        const task = await this.load(id);
        const att = (0, task_types_1.normalizeAttachments)(task.attachments).find((a) => a.id === attId);
        if (!att)
            throw new common_1.NotFoundException('Attachment not found');
        return att;
    }
    async link(id, kind, targetId, actor) {
        const task = await this.load(id);
        targetId = String(targetId || '').trim();
        if (!targetId)
            throw new common_1.BadRequestException('Pick what to link it to.');
        if (kind === 'task') {
            if (targetId === id)
                throw new common_1.BadRequestException('An entry can’t be linked to itself.');
            const other = await this.load(targetId);
            if (!cleanIds(task.linkedTaskIds).includes(targetId)) {
                task.linkedTaskIds = [...cleanIds(task.linkedTaskIds), targetId];
                task.activity = [...(0, task_types_1.normalizeList)(task.activity), (0, task_types_1.event)('link', actor, { text: `linked task ${taskTitle(other)}` })];
            }
            if (!cleanIds(other.linkedTaskIds).includes(id)) {
                other.linkedTaskIds = [...cleanIds(other.linkedTaskIds), id];
                other.activity = [...(0, task_types_1.normalizeList)(other.activity), (0, task_types_1.event)('link', actor, { text: `linked ${task.topicType || 'entry'} ${taskTitle(task)}` })];
                other.updatedAt = new Date().toISOString();
                await this.repo.save(other);
            }
        }
        else if (kind === 'changeOrder') {
            const co = this.cos ? await this.cos.findOneBy({ id: targetId }) : null;
            if (this.cos && !co)
                throw new common_1.NotFoundException('Change order not found');
            if (!cleanIds(task.changeOrderIds).includes(targetId)) {
                task.changeOrderIds = [...cleanIds(task.changeOrderIds), targetId];
                task.activity = [...(0, task_types_1.normalizeList)(task.activity), (0, task_types_1.event)('link', actor, { text: `linked change order ${co ? `${co.number} · ${co.title}` : targetId}` })];
            }
        }
        else {
            throw new common_1.BadRequestException('Link to a task or a change order.');
        }
        task.updatedAt = new Date().toISOString();
        return this.hydrate(await this.repo.save(task));
    }
    async unlink(id, kind, targetId, actor) {
        const task = await this.load(id);
        if (kind === 'task') {
            task.linkedTaskIds = cleanIds(task.linkedTaskIds).filter((x) => x !== targetId);
            const other = await this.repo.findOneBy({ id: targetId });
            if (other && cleanIds(other.linkedTaskIds).includes(id)) {
                other.linkedTaskIds = cleanIds(other.linkedTaskIds).filter((x) => x !== id);
                await this.repo.save(other);
            }
        }
        else {
            task.changeOrderIds = cleanIds(task.changeOrderIds).filter((x) => x !== targetId);
        }
        task.activity = [...(0, task_types_1.normalizeList)(task.activity), (0, task_types_1.event)('link', actor, { text: `removed a link to ${kind === 'task' ? 'task' : 'change order'} ${targetId}` })];
        task.updatedAt = new Date().toISOString();
        return this.hydrate(await this.repo.save(task));
    }
    async createLinkedTask(id, dto, actor) {
        const source = await this.load(id);
        const kind = source.topicType || 'entry';
        const created = await this.create({
            topicType: 'Task',
            subject: String(dto.subject || '').trim() || `Follow up: ${taskTitle(source)}`.slice(0, 300),
            description: String(dto.description || '').trim() || `From ${kind} ${source.id}: ${taskTitle(source)}`,
            assignedTo: dto.assignedTo, assignedToId: dto.assignedToId, dueDate: dto.dueDate || undefined,
            project: source.project || '', tab: source.tab || 'internal',
            meetingType: source.meetingType, meetingDate: source.meetingDate, meetingId: source.meetingId || undefined,
        }, actor);
        const entry = await this.link(id, 'task', created.id, actor);
        return { task: await this.findOne(created.id), entry };
    }
    async addComment(id, text, actor) {
        const task = await this.load(id);
        if (!text?.trim())
            throw new common_1.NotFoundException('Comment text is required');
        const comment = {
            id: (0, task_types_1.subId)('c'),
            author: actor.name,
            authorId: actor.id,
            text: text.trim(),
            date: new Date().toISOString(),
        };
        task.comments = [...(0, task_types_1.normalizeList)(task.comments), comment];
        task.activity = [...(0, task_types_1.normalizeList)(task.activity), (0, task_types_1.event)('comment', actor, { text: comment.text })];
        const saved = await this.repo.save(task);
        const followers = [...(0, task_types_1.normalizeCollaborators)(saved.collaborators).map((c) => c.id), saved.assignedToId].filter(Boolean);
        if (followers.length)
            this.notifications.taskFollowUp(this.notice(saved, actor), followers, { kind: 'comment', comment: comment.text });
        return this.hydrate(saved);
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.TaskEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __param(5, (0, common_1.Optional)()),
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.ChangeOrderEntity)),
    __param(6, (0, common_1.Optional)()),
    __param(6, (0, typeorm_1.InjectRepository)(entities_1.ChecklistTemplateEntity)),
    __param(7, (0, common_1.Optional)()),
    __param(7, (0, typeorm_1.InjectRepository)(entities_1.LeadEntity)),
    __param(8, (0, common_1.Optional)()),
    __param(8, (0, typeorm_1.InjectRepository)(entities_1.DealEntity)),
    __param(9, (0, common_1.Optional)()),
    __param(9, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        attachments_service_1.AttachmentsService,
        notifications_service_1.NotificationsService,
        settings_service_1.SettingsService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], TasksService);
function cleanIds(v) {
    return [...new Set((0, task_types_1.normalizeList)(v).map((x) => String(x ?? '').trim()).filter(Boolean))];
}
function taskTitle(t) {
    return (t.subject || '').trim() || (t.description || '').split(/\r?\n/)[0].trim().slice(0, 120) || t.id;
}
//# sourceMappingURL=tasks.service.js.map