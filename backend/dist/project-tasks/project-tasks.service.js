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
let ProjectTasksService = class ProjectTasksService {
    constructor(repo, sections) {
        this.repo = repo;
        this.sections = sections;
        this.log = new common_1.Logger('ProjectTasksService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(project_tasks_1.DEFAULT_TASKS);
                this.log.log(`Seeded ${project_tasks_1.DEFAULT_TASKS.length} project tasks`);
            }
        }
        catch (err) {
            this.log.error('Task seed failed: ' + err.message);
        }
    }
    async findAll(projectId) {
        const rows = await this.repo.find({ order: { order: 'ASC' } });
        return projectId ? rows.filter((t) => Number(t.projectId) === projectId) : rows;
    }
    async board(projectId) {
        const sections = await this.sections.forProject(projectId);
        const tasks = await this.findAll(projectId);
        return { sections, tasks };
    }
    create(dto) {
        const id = dto.id || 'T-' + String(Date.now());
        const task = {
            order: 0, completed: false, parentId: null, attachments: [], comments: [],
            createdAt: new Date().toISOString().slice(0, 10),
            ...dto,
            projectId: Number(dto.projectId),
            id,
        };
        return this.repo.save(this.repo.create(task));
    }
    async update(id, dto) {
        let task = await this.repo.findOneBy({ id });
        if (!task)
            task = this.repo.create({ id, createdAt: new Date().toISOString().slice(0, 10) });
        Object.assign(task, dto, { id });
        return this.repo.save(task);
    }
    async reparentTasks(fromSectionId, toSectionId) {
        await this.repo.update({ sectionId: fromSectionId }, { sectionId: toSectionId });
    }
    async deleteTasksInSection(sectionId) {
        await this.repo.delete({ sectionId });
    }
    async remove(id) {
        const task = await this.repo.findOneBy({ id });
        if (task)
            await this.repo.remove(task);
        const subs = await this.repo.find({ where: { parentId: id } });
        if (subs.length)
            await this.repo.remove(subs);
        return { id, deleted: true };
    }
};
exports.ProjectTasksService = ProjectTasksService;
exports.ProjectTasksService = ProjectTasksService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ProjectTaskEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        sections_service_1.SectionsService])
], ProjectTasksService);
//# sourceMappingURL=project-tasks.service.js.map