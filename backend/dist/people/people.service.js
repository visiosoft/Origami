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
exports.PeopleService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
let PeopleService = class PeopleService {
    constructor(repo) {
        this.repo = repo;
    }
    async findAll(project) {
        const all = await this.repo.find({ order: { id: 'ASC' } });
        return project ? all.filter((p) => (p.projects ?? []).includes(project)) : all;
    }
    async findOne(id) {
        const person = await this.repo.findOneBy({ id: Number(id) });
        if (!person)
            throw new common_1.NotFoundException(`Person ${id} not found`);
        return person;
    }
    async nextId() {
        const rows = await this.repo.find();
        return rows.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;
    }
    async create(dto) {
        const id = Number(dto.id) || (await this.nextId());
        const person = { projects: [], openTasks: 0, comply: null, since: 'Added today', last: 'Just added', ...dto, id };
        return this.repo.save(this.repo.create(person));
    }
    async update(id, dto) {
        const numId = Number(id);
        const person = await this.repo.findOneBy({ id: numId });
        if (!person)
            throw new common_1.NotFoundException(`Person ${id} not found`);
        Object.assign(person, dto, { id: numId });
        return this.repo.save(person);
    }
    async remove(id) {
        const numId = Number(id);
        const person = await this.repo.findOneBy({ id: numId });
        if (person)
            await this.repo.remove(person);
        return { id: numId, deleted: true };
    }
};
exports.PeopleService = PeopleService;
exports.PeopleService = PeopleService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.PersonEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], PeopleService);
//# sourceMappingURL=people.service.js.map