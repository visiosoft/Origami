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
exports.ProjectTasksService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const project_tasks_1 = require("../seed-data/project-tasks");
const sections_service_1 = require("./sections.service");
const task_types_1 = require("../database/task.types");
const assignee_util_1 = require("../database/assignee.util");
const attachments_service_1 = require("../google/attachments.service");
let ProjectTasksService = class ProjectTasksService {
    constructor(repo, users, sections, attachments) {
        this.repo = repo;
        this.users = users;
        this.sections = sections;
        this.attachments = attachments;
        this.log = new common_1.Logger('ProjectTasksService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(project_tasks_1.DEFAULT_TASKS);
                this.log.log(`Seeded ${project_tasks_1.DEFAULT_TASKS.length} project tasks`);
            }
            await (0, assignee_util_1.backfillAssignees)(this.repo, this.users, 'assigneeId', 'assignee', this.log);
        }
        catch (err) {
            this.log.error('Task seed failed: ' + err.message);
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
    async findAll(projectId) {
        const rows = await this.repo.find({ order: { order: 'ASC' } });
        const scoped = projectId ? rows.filter((t) => Number(t.projectId) === projectId) : rows;
        return scoped.map((t) => this.hydrate(t));
    }
    async board(projectId) {
        const sections = await this.sections.forProject(projectId);
        const tasks = await this.findAll(projectId);
        return { sections, tasks };
    }
    async load(id) {
        const task = await this.repo.findOneBy({ id });
        if (!task)
            throw new common_1.NotFoundException(`Task ${id} not found`);
        return task;
    }
    syncStatus(task, patch) {
        if ('status' in patch) {
            patch.completed = patch.status === 'Done';
        }
        else if ('completed' in patch) {
            const wasDone = (task.status || '') === 'Done';
            if (patch.completed)
                patch.status = 'Done';
            else if (wasDone || !task.status)
                patch.status = 'In progress';
        }
    }
    async create(dto, actor = { name: 'Unknown' }) {
        const id = dto.id || 'T-' + String(Date.now());
        const assignee = await (0, assignee_util_1.resolveAssignee)(this.users, { id: dto.assigneeId, name: dto.assignee });
        const task = {
            order: 0, completed: false, parentId: null, attachments: [], comments: [],
            createdAt: new Date().toISOString().slice(0, 10),
            ...dto,
            assignee: assignee.name,
            assigneeId: assignee.id ?? undefined,
            status: dto.status || (dto.completed ? 'Done' : 'Not started'),
            checklist: (0, task_types_1.normalizeList)(dto.checklist),
            labels: (0, task_types_1.normalizeList)(dto.labels),
            activity: [(0, task_types_1.event)('created', actor, { text: 'created this task' })],
            updatedAt: new Date().toISOString(),
            projectId: Number(dto.projectId),
            id,
        };
        return this.hydrate(await this.repo.save(this.repo.create(task)));
    }
    async update(id, dto, actor = { name: 'Unknown' }) {
        let task = await this.repo.findOneBy({ id });
        if (!task)
            task = this.repo.create({ id, createdAt: new Date().toISOString().slice(0, 10) });
        const patch = { ...dto };
        delete patch.id;
        if ('assignee' in patch || 'assigneeId' in patch) {
            const assignee = await (0, assignee_util_1.resolveAssignee)(this.users, { id: patch.assigneeId, name: patch.assignee });
            patch.assignee = assignee.name;
            patch.assigneeId = assignee.id ?? null;
        }
        this.syncStatus(task, patch);
        const events = (0, task_types_1.diffEvents)(task, patch, actor);
        Object.assign(task, patch, { id });
        task.activity = [...(0, task_types_1.normalizeList)(task.activity), ...events];
        task.updatedAt = new Date().toISOString();
        return this.hydrate(await this.repo.save(task));
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
        return `Project ${task.projectId}`;
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
        return this.hydrate(await this.repo.save(task));
    }
};
exports.ProjectTasksService = ProjectTasksService;
exports.ProjectTasksService = ProjectTasksService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ProjectTaskEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        sections_service_1.SectionsService,
        attachments_service_1.AttachmentsService])
], ProjectTasksService);
//# sourceMappingURL=project-tasks.service.js.map