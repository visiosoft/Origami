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
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const task_types_1 = require("../database/task.types");
const assignee_util_1 = require("../database/assignee.util");
const attachments_service_1 = require("../google/attachments.service");
const SCOPE = 'Request Log';
let TasksService = class TasksService {
    constructor(repo, users, attachments) {
        this.repo = repo;
        this.users = users;
        this.attachments = attachments;
        this.log = new common_1.Logger('TasksService');
    }
    async onApplicationBootstrap() {
        try {
            await (0, assignee_util_1.backfillAssignees)(this.repo, this.users, 'assignedToId', 'assignedTo', this.log);
        }
        catch (err) {
            this.log.error('Assignee backfill failed: ' + err.message);
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
        };
    }
    async findAll(tab, project) {
        const where = {};
        if (tab)
            where.tab = tab;
        if (project)
            where.project = project;
        const rows = await this.repo.find({ where });
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
        const start = Date.parse(task.meetingDate);
        if (Number.isNaN(start))
            return task.daysOpen ?? 0;
        const end = task.dateClosed ? Date.parse(task.dateClosed) : Date.now();
        if (Number.isNaN(end))
            return task.daysOpen ?? 0;
        return Math.max(0, Math.round((end - start) / 86400000));
    }
    async create(dto, actor) {
        const rows = await this.repo.find();
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const seq = rows
            .filter((t) => String(t.id).startsWith(dateStr + '-'))
            .reduce((max, t) => Math.max(max, parseInt(String(t.id).split('-')[1], 10) || 0), 0) + 1;
        const id = dto.id || `${dateStr}-${String(seq).padStart(2, '0')}`;
        const assignee = await (0, assignee_util_1.resolveAssignee)(this.users, { id: dto.assignedToId, name: dto.assignedTo });
        const task = this.repo.create({
            tab: 'internal',
            meetingType: 'Internal',
            meetingDate: new Date().toISOString().slice(0, 10),
            status: 'Open',
            topicType: 'Task',
            description: '',
            project: '',
            daysOpen: 0,
            ...dto,
            id,
            assignedTo: assignee.name,
            assignedToId: assignee.id ?? undefined,
            attachments: [],
            comments: [],
            checklist: (0, task_types_1.normalizeList)(dto.checklist),
            labels: (0, task_types_1.normalizeList)(dto.labels),
            activity: [(0, task_types_1.event)('created', actor, { text: 'created this task' })],
            updatedAt: new Date().toISOString(),
        });
        return this.hydrate(await this.repo.save(task));
    }
    async update(id, dto, actor) {
        const task = await this.load(id);
        const patch = { ...dto };
        delete patch.id;
        if ('assignedTo' in patch || 'assignedToId' in patch) {
            const assignee = await (0, assignee_util_1.resolveAssignee)(this.users, {
                id: patch.assignedToId,
                name: patch.assignedTo,
            });
            patch.assignedTo = assignee.name;
            patch.assignedToId = assignee.id ?? null;
        }
        if (patch.status === 'Closed' && task.status !== 'Closed' && !patch.dateClosed) {
            patch.dateClosed = new Date().toISOString().slice(0, 10);
        }
        if (patch.status && patch.status !== 'Closed')
            patch.dateClosed = '';
        const events = (0, task_types_1.diffEvents)(task, patch, actor);
        Object.assign(task, patch, { id });
        task.activity = [...(0, task_types_1.normalizeList)(task.activity), ...events];
        task.daysOpen = this.daysOpen(task);
        task.updatedAt = new Date().toISOString();
        return this.hydrate(await this.repo.save(task));
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
        return this.hydrate(await this.repo.save(task));
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.TaskEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        attachments_service_1.AttachmentsService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map