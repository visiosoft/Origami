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
exports.ProjectProgramService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
let ProjectProgramService = class ProjectProgramService {
    constructor(repo, projects) {
        this.repo = repo;
        this.projects = projects;
        this.log = new common_1.Logger('ProjectProgramService');
    }
    parse(raw) {
        if (!raw)
            return {};
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        }
        catch {
            return {};
        }
    }
    async get(projectId) {
        if (!Number.isFinite(projectId))
            throw new common_1.BadRequestException('Which project?');
        const row = await this.repo.findOneBy({ projectId });
        return {
            projectId,
            data: this.parse(row?.data),
            updatedAt: row?.updatedAt || '',
            updatedBy: row?.updatedBy || '',
            completedAt: row?.completedAt || '',
            sentAt: row?.sentAt || '',
            sentTo: row?.sentTo || '',
        };
    }
    async save(projectId, data, actor) {
        if (!Number.isFinite(projectId))
            throw new common_1.BadRequestException('Which project?');
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new common_1.BadRequestException('The program must be an object of answers.');
        }
        if (!(await this.projects.findOneBy({ id: projectId }))) {
            throw new common_1.BadRequestException(`Project ${projectId} not found`);
        }
        const existing = await this.repo.findOneBy({ projectId });
        const row = existing || this.repo.create({ projectId });
        row.data = JSON.stringify(data);
        row.updatedAt = new Date().toISOString();
        row.updatedBy = actor?.name || 'System';
        await this.repo.save(row);
        return this.get(projectId);
    }
    async markSent(projectId, to, actor) {
        const row = await this.repo.findOneBy({ projectId });
        if (!row)
            return;
        row.sentAt = new Date().toISOString();
        row.sentTo = to || '';
        row.updatedBy = actor?.name || row.updatedBy || 'System';
        await this.repo.save(row);
    }
    async setComplete(projectId, complete) {
        const row = await this.repo.findOneBy({ projectId });
        if (!row)
            throw new common_1.BadRequestException('Nothing has been filled in yet.');
        row.completedAt = complete ? new Date().toISOString() : '';
        await this.repo.save(row);
        return this.get(projectId);
    }
};
exports.ProjectProgramService = ProjectProgramService;
exports.ProjectProgramService = ProjectProgramService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ProjectProgramEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ProjectProgramService);
//# sourceMappingURL=project-program.service.js.map