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
const tasks_1 = require("../seed-data/tasks");
function flatSeed() {
    const rows = [];
    ['internal', 'owner', 'subcontractor'].forEach((tab) => {
        tasks_1.ALL_TASKS[tab].forEach((t) => rows.push({ ...t, tab }));
    });
    return rows;
}
let TasksService = class TasksService {
    constructor(repo) {
        this.repo = repo;
        this.mem = flatSeed();
    }
    findAll(tab, project) {
        if (this.repo) {
            const where = {};
            if (tab)
                where.tab = tab;
            if (project)
                where.project = project;
            return this.repo.find({ where });
        }
        let rows = this.mem;
        if (tab)
            rows = rows.filter((t) => t.tab === tab);
        if (project)
            rows = rows.filter((t) => t.project === project);
        return rows;
    }
    async findOne(id) {
        const task = this.repo ? await this.repo.findOneBy({ id }) : this.mem.find((t) => t.id === id);
        if (!task)
            throw new common_1.NotFoundException(`Task ${id} not found`);
        return task;
    }
    create(dto) {
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const id = dto.id || `${dateStr}-${String(now.getTime()).slice(-2)}`;
        const task = { tab: 'internal', daysOpen: 0, ...dto, id };
        if (this.repo)
            return this.repo.save(this.repo.create(task));
        this.mem = [task, ...this.mem];
        return task;
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.TaskEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], TasksService);
//# sourceMappingURL=tasks.service.js.map