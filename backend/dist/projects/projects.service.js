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
exports.ProjectsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const projects_1 = require("../seed-data/projects");
let ProjectsService = class ProjectsService {
    constructor(repo) {
        this.repo = repo;
        this.mem = [...projects_1.PROJECTS];
    }
    findAll() {
        return this.repo ? this.repo.find({ order: { id: 'ASC' } }) : this.mem;
    }
    async findOne(id) {
        const project = this.repo
            ? await this.repo.findOneBy({ id: Number(id) })
            : this.mem.find((p) => String(p.id) === String(id));
        if (!project)
            throw new common_1.NotFoundException(`Project ${id} not found`);
        return project;
    }
    create(dto) {
        if (this.repo)
            return this.repo.save(this.repo.create(dto));
        const project = { id: this.mem.length + 1, ...dto };
        this.mem = [project, ...this.mem];
        return project;
    }
    async update(id, dto) {
        if (this.repo) {
            await this.repo.update({ id: Number(id) }, dto);
            return this.findOne(id);
        }
        const i = this.mem.findIndex((p) => String(p.id) === String(id));
        if (i === -1)
            throw new common_1.NotFoundException(`Project ${id} not found`);
        this.mem[i] = { ...this.mem[i], ...dto };
        return this.mem[i];
    }
};
exports.ProjectsService = ProjectsService;
exports.ProjectsService = ProjectsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ProjectsService);
//# sourceMappingURL=projects.service.js.map