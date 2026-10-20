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
exports.ProjectTasksService = exports.ARCHIVE_AFTER_DAYS = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const mentions_1 = require("../tasks/mentions");
const task_rules_1 = require("../tasks/task-rules");
const entities_1 = require("../database/entities");
const lead_link_1 = require("../tasks/lead-link");
const pending_notices_1 = require("../notifications/pending-notices");
const auto_checklist_1 = require("./auto-checklist");
const project_tasks_1 = require("../seed-data/project-tasks");
const sections_service_1 = require("./sections.service");
const task_types_1 = require("../database/task.types");
const assignee_util_1 = require("../database/assignee.util");
const attachments_service_1 = require("../google/attachments.service");
const notifications_service_1 = require("../notifications/notifications.service");
const serials_1 = require("../database/serials");
exports.ARCHIVE_AFTER_DAYS = 7;
let ProjectTasksService = class ProjectTasksService {
    constructor(repo, users, sections, attachments, notifications, checklistTemplates, leads) {
        this.repo = repo;
        this.users = users;
        this.sections = sections;
        this.attachments = attachments;
        this.notifications = notifications;
        this.checklistTemplates = checklistTemplates;
        this.leads = leads;
        this.log = new common_1.Logger('ProjectTasksService');
    }
    async adoptLead(leadId, projectId) {
        const rows = (await this.repo.findBy({ leadId })).filter((t) => t.projectId == null);
        if (!rows.length)
            return 0;
        const sections = await this.sections.forProject(projectId);
        for (const t of rows) {
            const home = sections.find((s) => (0, task_types_1.bucketStatus)(s.name) === (0, task_types_1.normalizeTaskStatus)(t.status)) || sections[0];
            await this.repo.update({ id: t.id }, { projectId, ...(t.parentId ? {} : { sectionId: home?.id ?? t.sectionId }) });
        }
        return rows.length;
    }
    async onApplicationBootstrap() {
        const tick = setInterval(() => { this.flushOverdue().catch((e) => this.log.warn('Held task emails: ' + e.message)); }, 60_000);
        tick.unref?.();
        const starts = setInterval(() => { this.startDueTasks().catch((e) => this.log.warn('Task start dates: ' + e.message)); }, 30 * 60_000);
        starts.unref?.();
        this.startDueTasks().catch(() => undefined);
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(project_tasks_1.DEFAULT_TASKS);
                this.log.log(`Seeded ${project_tasks_1.DEFAULT_TASKS.length} project tasks`);
            }
            await (0, assignee_util_1.backfillAssignees)(this.repo, this.users, 'assigneeId', 'assignee', this.log);
            await this.renameLegacyTitles();
            const fixed = await this.fixCompleted();
            if (fixed)
                this.log.log(`Put ${fixed} completed task(s) in Done`);
            const blocked = await this.repo.findBy({ status: 'Blocked' });
            if (blocked.length) {
                for (const t of blocked)
                    t.status = 'On hold';
                await this.repo.save(blocked);
                this.log.log(`Renamed ${blocked.length} task status(es) Blocked -> On hold`);
            }
        }
        catch (err) {
            this.log.error('Task seed failed: ' + err.message);
        }
        try {
            const rows = await this.repo.find();
            const pairs = (0, serials_1.backfillSerials)(rows, (t) => String(t.projectId ?? ''), () => 'task', (t) => t.createdAt);
            for (const [id, serial] of pairs)
                await this.repo.update({ id }, { serial });
            if (pairs.length)
                this.log.log(`Gave ${pairs.length} board task(s) a serial number`);
        }
        catch (err) {
            this.log.error('Board task serial numbers failed: ' + err.message);
        }
    }
    async renameLegacyTitles() {
        const RENAMES = [
            ['Press Release & Project Info', 'Project Info'],
        ];
        for (const [from, to] of RENAMES) {
            const rows = await this.repo.findBy({ title: from });
            if (!rows.length)
                continue;
            for (const row of rows)
                row.title = to;
            await this.repo.save(rows);
            this.log.log(`Renamed ${rows.length} task(s): "${from}" -> "${to}"`);
        }
    }
    hydrate(task) {
        return {
            ...task,
            attachments: (0, task_types_1.normalizeAttachments)(task.attachments),
            comments: (0, task_types_1.normalizeList)(task.comments),
            activity: (0, task_types_1.normalizeList)(task.activity),
            checklist: (0, task_types_1.normalizeList)(task.checklist),
            labels: (0, task_types_1.normalizeList)(task.labels),
            dependsOn: (0, task_types_1.normalizeList)(task.dependsOn),
            status: task.status || (task.completed ? 'Done' : 'Not started'),
        };
    }
    async archiveConfirmed(rows) {
        const cutoff = Date.now() - exports.ARCHIVE_AFTER_DAYS * 86400000;
        const due = rows.filter((t) => t.status === 'Confirmed' && !t.archivedAt && t.confirmedAt && Date.parse(t.confirmedAt) <= cutoff && (!t.updatedAt || Date.parse(t.updatedAt) <= cutoff));
        if (!due.length)
            return;
        const at = new Date().toISOString();
        for (const t of due)
            t.archivedAt = at;
        await this.repo.save(due).catch((e) => this.log.warn('Archiving confirmed tasks failed: ' + e.message));
    }
    async findAll(projectId) {
        const rows = await this.repo.find({ order: { order: 'ASC' } });
        await this.archiveConfirmed(rows);
        const scoped = projectId === undefined
            ? rows
            : projectId === null
                ? rows.filter((t) => t.projectId == null)
                : rows.filter((t) => Number(t.projectId) === projectId);
        return scoped.map((t) => this.hydrate(t));
    }
    async board(projectId) {
        const sections = await this.sections.forProject(projectId);
        const tasks = await this.findAll(projectId);
        return { sections, tasks };
    }
    async get(id) {
        return this.load(id);
    }
    async load(id) {
        const task = await this.repo.findOneBy({ id });
        if (!task)
            throw new common_1.NotFoundException(`Task ${id} not found`);
        return task;
    }
    async syncBucketSection(task, patch) {
        const projectId = patch.projectId !== undefined ? patch.projectId : task.projectId;
        if (projectId === undefined)
            return;
        const sections = await this.sections.forProject(projectId == null ? null : Number(projectId));
        const bucketOf = (id) => (0, task_types_1.bucketStatus)(sections.find((x) => x.id === id)?.name);
        const movingSection = 'sectionId' in patch && patch.sectionId !== task.sectionId;
        const changingStatus = 'status' in patch && patch.status !== task.status;
        if (movingSection && !changingStatus) {
            const into = bucketOf(patch.sectionId);
            if (into)
                patch.status = into;
            else if ((0, task_types_1.isDoneStatus)(task.status))
                patch.status = 'In progress';
            else if (task.status === 'On hold' && bucketOf(task.sectionId) === 'On hold')
                patch.status = 'In progress';
        }
        else if (changingStatus && !movingSection) {
            if (bucketOf(task.sectionId) === patch.status)
                return;
            const target = sections.find((x) => (0, task_types_1.bucketStatus)(x.name) === patch.status)
                || (patch.status === 'Confirmed' ? sections.find((x) => (0, task_types_1.bucketStatus)(x.name) === 'Done') : undefined)
                || (patch.status === 'Assigned' ? sections.find((x) => (0, task_types_1.bucketStatus)(x.name) === 'Not started') : undefined);
            if (target && target.id !== task.sectionId)
                patch.sectionId = target.id;
            else if (!target && bucketOf(task.sectionId) && bucketOf(task.sectionId) !== patch.status) {
                const fallback = sections.find((x) => (0, task_types_1.bucketStatus)(x.name) === 'In progress');
                if (fallback && patch.status !== 'Assigned' && patch.status !== 'Not started')
                    patch.sectionId = fallback.id;
            }
        }
    }
    async syncStatus(task, patch, actor) {
        if ('status' in patch) {
            patch.completed = (0, task_types_1.isDoneStatus)(patch.status);
        }
        else if ('completed' in patch) {
            if (patch.completed) {
                if (!(0, task_types_1.isDoneStatus)(task.status))
                    patch.status = 'Done';
            }
            else if ((0, task_types_1.isDoneStatus)(task.status) || !task.status)
                patch.status = 'In progress';
        }
        const assigned = 'assigneeId' in patch || 'assignee' in patch
            ? !!(patch.assigneeId || (patch.assignee || '').trim())
            : !!(task.assigneeId || (task.assignee || '').trim());
        const status = patch.status ?? task.status ?? 'Not started';
        if (status === 'Not started' && assigned)
            patch.status = 'Assigned';
        if (status === 'Assigned' && !assigned)
            patch.status = 'Not started';
        const board = !(patch.phaseId ?? task.phaseId);
        const pending = (s) => !s || s === 'Not started' || s === 'Assigned';
        if (board && 'startDate' in patch && patch.startDate !== task.startDate && pending(patch.status ?? task.status) && (0, task_rules_1.startDue)(patch.startDate, assigned)) {
            patch.status = 'In progress';
        }
        let next = patch.status ?? task.status;
        if (board && next === 'In progress' && task.status !== 'In progress' && !assigned) {
            if (!(0, task_types_1.isDoneStatus)(task.status))
                throw new common_1.BadRequestException(task_rules_1.NO_ASSIGNEE_IN_PROGRESS);
            patch.status = next = 'Not started';
        }
        if (next === 'In progress' && task.status !== 'In progress' && !task.startDate && !patch.startDate) {
            patch.startDate = new Date().toISOString().slice(0, 10);
        }
        if (next === 'Confirmed' && task.status !== 'Confirmed') {
            const originator = task.createdById || this.createdByIdOf(task);
            if (originator && actor.id !== originator && !(await this.isAdmin(actor))) {
                throw new common_1.BadRequestException(`Only ${task.createdByName || 'whoever created it'} (or an admin) can confirm this task.`);
            }
            patch.confirmedAt = new Date().toISOString();
            patch.completed = true;
        }
        else if (next !== 'Confirmed' && task.confirmedAt) {
            patch.confirmedAt = null;
            patch.archivedAt = null;
        }
        if ((task.archivedAt || task.closedAt) && 'status' in patch && patch.status !== task.status) {
            patch.archivedAt = null;
            patch.closedAt = null;
        }
    }
    createdByIdOf(task) {
        const ev = (0, task_types_1.normalizeList)(task.activity).find((e) => e.type === 'created');
        return ev?.actorId || ev?.byId || undefined;
    }
    async isAdmin(actor) {
        if (!actor.id)
            return false;
        const u = await this.users.findOneBy({ id: actor.id });
        return u?.roleKey === 'admin';
    }
    assertSubtaskFields(t) {
        const missing = [!(t.assigneeId || (t.assignee || '').trim()) && 'an assignee', !(t.dueDate || '').trim() && 'a due date'].filter(Boolean);
        if (missing.length)
            throw new common_1.BadRequestException(`A subtask needs ${missing.join(' and ')}.`);
    }
    async assertSubtasksDone(parentId) {
        const open = (await this.repo.find({ where: { parentId } })).filter((s) => !s.completed && !(0, task_types_1.isDoneStatus)(s.status));
        if (open.length)
            throw new common_1.BadRequestException(`Finish its ${open.length} open subtask${open.length === 1 ? '' : 's'} first.`);
    }
    async create(dto, actor = { name: 'Unknown' }) {
        if (dto.parentId)
            this.assertSubtaskFields(dto);
        const defer = !!dto.parentId || !!dto.deferNotify;
        dto = { ...dto };
        delete dto.deferNotify;
        delete dto.pendingNotices;
        const id = dto.id || 'T-' + String(Date.now());
        if (dto.status) {
            dto = { ...dto, status: (0, task_types_1.normalizeTaskStatus)(dto.status) };
            const p = { status: dto.status };
            await this.syncBucketSection({ projectId: dto.projectId == null ? null : Number(dto.projectId), sectionId: dto.sectionId, status: '' }, p);
            if (p.sectionId)
                dto.sectionId = p.sectionId;
        }
        else if (dto.sectionId) {
            const sections = await this.sections.forProject(dto.projectId == null ? null : Number(dto.projectId));
            const b = (0, task_types_1.bucketStatus)(sections.find((x) => x.id === dto.sectionId)?.name);
            if (b)
                dto = { ...dto, status: b };
        }
        const assignee = await (0, assignee_util_1.resolveAssignee)(this.users, { id: dto.assigneeId, name: dto.assignee });
        if (dto.leadId !== undefined)
            dto = { ...dto, ...(await (0, lead_link_1.resolveLead)(this.leads, dto.leadId)) };
        const templates = !dto.parentId && this.checklistTemplates ? await this.checklistTemplates.find().catch(() => []) : [];
        const checklist = (0, auto_checklist_1.withAutoChecklists)(templates, { kind: 'task', labels: (0, task_types_1.normalizeList)(dto.labels) }, (0, task_types_1.normalizeList)(dto.checklist));
        const requester = dto.requestedById || dto.requestedBy ? await (0, assignee_util_1.resolveAssignee)(this.users, { id: dto.requestedById, name: dto.requestedBy }) : null;
        let status = dto.status || (dto.completed ? 'Done' : 'Not started');
        if (status === 'Not started' && assignee.name)
            status = 'Assigned';
        const board = !dto.phaseId;
        if (board && (status === 'Not started' || status === 'Assigned') && (0, task_rules_1.startDue)(dto.startDate, !!assignee.name))
            status = 'In progress';
        if (board && status === 'In progress' && !assignee.name)
            throw new common_1.BadRequestException(task_rules_1.NO_ASSIGNEE_IN_PROGRESS);
        const task = {
            order: 0, parentId: null, attachments: [], comments: [],
            createdAt: new Date().toISOString().slice(0, 10),
            ...dto,
            assignee: assignee.name,
            assigneeId: assignee.id ?? undefined,
            ...(requester ? { requestedBy: requester.name, requestedById: requester.id ?? undefined } : {}),
            status,
            completed: (0, task_types_1.isDoneStatus)(status) || !!dto.completed,
            startDate: dto.startDate || (status === 'In progress' ? new Date().toISOString().slice(0, 10) : undefined),
            createdById: actor.id, createdByName: actor.name,
            checklist,
            labels: (0, task_types_1.normalizeList)(dto.labels),
            collaborators: (0, task_types_1.normalizeCollaborators)(dto.collaborators, assignee.id),
            activity: [(0, task_types_1.event)('created', actor, { text: 'created this task' })],
            updatedAt: new Date().toISOString(),
            projectId: dto.projectId == null ? null : Number(dto.projectId),
            id,
        };
        const peers = (await this.repo.find()).filter((t) => (t.projectId ?? null) === (task.projectId ?? null));
        task.serial = (0, serials_1.nextSerial)(peers.map((t) => t.serial), 'task', (0, serials_1.serialYear)());
        const at = new Date().toISOString();
        const who = { id: actor.id, name: actor.name };
        const followers = (0, task_types_1.normalizeCollaborators)(task.collaborators);
        const notices = [
            ...(assignee.id ? [{ kind: 'assigned', ids: [String(assignee.id)], actor: who, at }] : []),
            ...(followers.length ? [{ kind: 'added', ids: followers.map((c) => c.id), actor: who, at }] : []),
        ];
        if (defer)
            task.pendingNotices = (0, pending_notices_1.holdNotices)(null, notices);
        const saved = await this.repo.save(this.repo.create(task));
        if (!defer)
            this.sendNotices(saved, notices);
        return this.hydrate(saved);
    }
    notice(t, actor) {
        return { surface: 'board', taskId: t.id, title: t.title, description: t.description, projectId: t.projectId, dueDate: t.dueDate, priority: t.priority, status: t.status, actor };
    }
    async update(id, dto, actor = { name: 'Unknown' }) {
        let task = await this.repo.findOneBy({ id });
        if (!task)
            task = this.repo.create({ id, createdAt: new Date().toISOString().slice(0, 10) });
        const patch = { ...dto };
        delete patch.id;
        delete patch.serial;
        delete patch.pendingNotices;
        const defer = !!patch.deferNotify;
        delete patch.deferNotify;
        const closing = !!patch.close;
        delete patch.close;
        delete patch.closedAt;
        delete patch.archivedAt;
        if (closing && !(0, task_types_1.isDoneStatus)(task.status))
            patch.status = 'Done';
        if ('leadId' in patch)
            Object.assign(patch, await (0, lead_link_1.resolveLead)(this.leads, patch.leadId));
        if ('assignee' in patch || 'assigneeId' in patch) {
            const assignee = await (0, assignee_util_1.resolveAssignee)(this.users, { id: patch.assigneeId, name: patch.assignee });
            patch.assignee = assignee.name;
            patch.assigneeId = assignee.id ?? null;
        }
        if ('requestedBy' in patch || 'requestedById' in patch) {
            const src = await (0, assignee_util_1.resolveAssignee)(this.users, { id: patch.requestedById, name: patch.requestedBy });
            patch.requestedBy = src.name;
            patch.requestedById = src.id ?? null;
        }
        const note = (0, task_rules_1.cleanCompletionNote)(patch.completionNote);
        delete patch.completionNote;
        if ('status' in patch)
            patch.status = (0, task_types_1.normalizeTaskStatus)(patch.status);
        await this.syncBucketSection(task, patch);
        await this.syncStatus(task, patch, actor);
        await this.syncBucketSection(task, patch);
        if (task.parentId) {
            if ('dueDate' in patch && task.dueDate && !(patch.dueDate || '').trim())
                throw new common_1.BadRequestException('A subtask needs a due date.');
            if (('assignee' in patch || 'assigneeId' in patch) && (task.assigneeId || task.assignee) && !(patch.assigneeId || (patch.assignee || '').trim()))
                throw new common_1.BadRequestException('A subtask needs an assignee.');
        }
        if ((0, task_types_1.isDoneStatus)(patch.status) && !(0, task_types_1.isDoneStatus)(task.status) && !task.parentId)
            await this.assertSubtasksDone(id);
        let joined = [];
        const collabEvents = [];
        if ('collaborators' in patch) {
            patch.collaborators = (0, task_types_1.normalizeCollaborators)(patch.collaborators, patch.assigneeId ?? task.assigneeId);
            const { added, removed } = (0, task_types_1.collaboratorChanges)(task.collaborators, patch.collaborators);
            joined = added;
            if (added.length)
                collabEvents.push((0, task_types_1.event)('collaborators', actor, { text: `added ${added.map((c) => c.name).join(', ')} as collaborator${added.length === 1 ? '' : 's'}` }));
            if (removed.length)
                collabEvents.push((0, task_types_1.event)('collaborators', actor, { text: `removed ${removed.map((c) => c.name).join(', ')} from collaborators` }));
        }
        const finished = (0, task_types_1.isDoneStatus)(patch.status) && !(0, task_types_1.isDoneStatus)(task.status);
        const noteEvents = [];
        if (finished && !closing && !(patch.phaseId ?? task.phaseId)) {
            if (!note)
                throw new common_1.BadRequestException(task_rules_1.NEEDS_COMPLETION_NOTE);
        }
        if (finished && note) {
            patch.completionNote = note;
            noteEvents.push((0, task_types_1.event)('comment', actor, { text: `Completion note: ${note}` }));
        }
        if (closing) {
            const at = new Date().toISOString();
            patch.archivedAt = at;
            patch.closedAt = at;
            patch.completed = true;
        }
        const events = [...(0, task_types_1.diffEvents)(task, patch, actor), ...collabEvents, ...noteEvents, ...(closing ? [(0, task_types_1.event)('status', actor, { text: 'closed this task (archived)' })] : [])];
        const reassignedTo = 'assigneeId' in patch && patch.assigneeId && patch.assigneeId !== task.assigneeId
            ? String(patch.assigneeId)
            : null;
        const nextStatus = patch.status ?? task.status;
        if (nextStatus !== 'On hold' && task.holdReason)
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
        task.updatedAt = new Date().toISOString();
        if (defer && notices.length)
            task.pendingNotices = (0, pending_notices_1.holdNotices)(task.pendingNotices, notices);
        const saved = await this.repo.save(task);
        if (closing)
            for (const s of await this.repo.findBy({ parentId: id }))
                if (!s.archivedAt)
                    await this.repo.update({ id: s.id }, { archivedAt: saved.archivedAt });
        if (!defer)
            this.sendNotices(saved, notices);
        return this.hydrate(saved);
    }
    async fixCompleted() {
        const rows = await this.repo.find();
        const boards = new Map();
        const sectionsOf = async (pid) => {
            const k = String(pid ?? 'general');
            if (!boards.has(k))
                boards.set(k, await this.sections.forProject(pid));
            return boards.get(k);
        };
        let n = 0;
        for (const t of rows) {
            const patch = {};
            if (t.completed && !(0, task_types_1.isDoneStatus)(t.status))
                patch.status = 'Done';
            const status = patch.status ?? t.status;
            if ((0, task_types_1.isDoneStatus)(status) && !t.parentId && t.sectionId) {
                const sections = await sectionsOf(t.projectId == null ? null : Number(t.projectId));
                const here = (0, task_types_1.bucketStatus)(sections.find((s) => s.id === t.sectionId)?.name);
                if (!(0, task_types_1.isDoneStatus)(here || '')) {
                    const done = sections.find((s) => (0, task_types_1.bucketStatus)(s.name) === (status === 'Confirmed' ? 'Confirmed' : 'Done')) || sections.find((s) => (0, task_types_1.bucketStatus)(s.name) === 'Done');
                    if (done)
                        patch.sectionId = done.id;
                }
            }
            if (Object.keys(patch).length) {
                await this.repo.update({ id: t.id }, patch);
                n++;
            }
        }
        return n;
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
    async flushNotices(id, withSubtasks = true) {
        const rows = [await this.repo.findOneBy({ id }), ...(withSubtasks ? await this.repo.findBy({ parentId: id }) : [])].filter(Boolean);
        let sent = 0;
        for (const t of rows.filter((x) => x.pendingNotices?.length)) {
            const live = (0, pending_notices_1.stillTrue)(t.pendingNotices, { assigneeId: t.assigneeId, collaboratorIds: (0, task_types_1.normalizeCollaborators)(t.collaborators).map((c) => c.id), done: (0, task_types_1.isDoneStatus)(t.status) });
            await this.repo.update({ id: t.id }, { pendingNotices: null });
            this.sendNotices(t, live);
            sent += live.length;
        }
        return { sent };
    }
    async startDueTasks() {
        const rows = (await this.repo.find()).filter((t) => !t.phaseId && !t.archivedAt && (!t.status || t.status === 'Not started' || t.status === 'Assigned')
            && (0, task_rules_1.startDue)(t.startDate, !!(t.assigneeId || (t.assignee || '').trim())));
        for (const t of rows) {
            try {
                await this.update(t.id, { status: 'In progress' }, { name: 'System' });
            }
            catch (e) {
                this.log.warn(`Start ${t.id}: ${e.message}`);
            }
        }
        return rows.length;
    }
    async flushOverdue() {
        for (const t of (await this.repo.find()).filter((x) => (0, pending_notices_1.overdue)(x.pendingNotices)))
            await this.flushNotices(t.id, false);
    }
    async reorder(sectionId, ids) {
        const rows = await this.repo.find({ where: { sectionId } });
        const byId = new Map(rows.map((t) => [t.id, t]));
        let position = 0;
        for (const id of ids) {
            const task = byId.get(id);
            if (!task)
                continue;
            task.order = position++;
            await this.repo.save(task);
        }
        return { sectionId, ordered: position };
    }
    async reparentTasks(fromSectionId, toSectionId) {
        await this.repo.update({ sectionId: fromSectionId }, { sectionId: toSectionId });
    }
    async deleteTasksInSection(sectionId) {
        await this.repo.delete({ sectionId });
    }
    async remove(id) {
        const task = await this.repo.findOneBy({ id });
        if (task) {
            await this.attachments.discardAll((0, task_types_1.normalizeAttachments)(task.attachments));
            await this.repo.remove(task);
        }
        const subs = await this.repo.find({ where: { parentId: id } });
        for (const sub of subs)
            await this.attachments.discardAll((0, task_types_1.normalizeAttachments)(sub.attachments));
        if (subs.length)
            await this.repo.remove(subs);
        return { id, deleted: true };
    }
    scopeFor(task) {
        return task.projectId == null ? 'General Tasks' : `Project ${task.projectId}`;
    }
    async addAttachments(id, files, actor) {
        const task = await this.load(id);
        const added = await this.attachments.upload(files, this.scopeFor(task), actor);
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
        const mentioned = (0, mentions_1.mentionedIds)(comment.text, await this.users.find());
        const followers = [...(0, task_types_1.normalizeCollaborators)(saved.collaborators).map((c) => c.id), saved.assigneeId].filter((x) => x && !mentioned.includes(x));
        if (mentioned.length)
            this.notifications.taskFollowUp(this.notice(saved, actor), mentioned, { kind: 'mention', comment: comment.text });
        if (followers.length)
            this.notifications.taskFollowUp(this.notice(saved, actor), followers, { kind: 'comment', comment: comment.text });
        return this.hydrate(saved);
    }
};
exports.ProjectTasksService = ProjectTasksService;
exports.ProjectTasksService = ProjectTasksService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ProjectTaskEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __param(5, (0, common_1.Optional)()),
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.ChecklistTemplateEntity)),
    __param(6, (0, common_1.Optional)()),
    __param(6, (0, typeorm_1.InjectRepository)(entities_1.LeadEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        sections_service_1.SectionsService,
        attachments_service_1.AttachmentsService,
        notifications_service_1.NotificationsService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ProjectTasksService);
//# sourceMappingURL=project-tasks.service.js.map