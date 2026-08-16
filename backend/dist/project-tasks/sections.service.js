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
exports.SectionsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const project_tasks_1 = require("../seed-data/project-tasks");
let SectionsService = class SectionsService {
    constructor(repo) {
        this.repo = repo;
        this.log = new common_1.Logger('SectionsService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(project_tasks_1.DEFAULT_SECTIONS);
                this.log.log(`Seeded ${project_tasks_1.DEFAULT_SECTIONS.length} project sections`);
            }
        }
        catch (err) {
            this.log.error('Section seed failed: ' + err.message);
        }
    }
    async getById(id) {
        return (await this.repo.findOneBy({ id })) ?? undefined;
    }
    async forProject(projectId) {
        if (!Number.isFinite(projectId))
            return [];
        let rows = await this.repo.find({ where: { projectId }, order: { order: 'ASC' } });
        if (!rows.length) {
            rows = await this.repo.save((0, project_tasks_1.defaultSectionsFor)(projectId));
        }
        return rows;
    }
    create(dto) {
        const projectId = Number(dto.projectId);
        const section = { name: 'New Section', order: 0, ...dto, projectId, id: dto.id || 'S-' + Date.now() };
        return this.repo.save(this.repo.create(section));
    }
    async update(id, dto) {
        let section = await this.repo.findOneBy({ id });
        if (!section)
            section = this.repo.create({ id });
        Object.assign(section, dto, { id });
        return this.repo.save(section);
    }
    async remove(id) {
        const section = await this.repo.findOneBy({ id });
        if (section)
            await this.repo.remove(section);
        return { id, deleted: true };
    }
};
exports.SectionsService = SectionsService;
exports.SectionsService = SectionsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ProjectSectionEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SectionsService);
//# sourceMappingURL=sections.service.js.map