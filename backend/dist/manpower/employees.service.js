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
exports.EmployeesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
let EmployeesService = class EmployeesService {
    constructor(repo) {
        this.repo = repo;
    }
    findAll() {
        return this.repo.find({ order: { name: 'ASC' } });
    }
    async findOne(id) {
        const employee = await this.repo.findOneBy({ id });
        if (!employee)
            throw new common_1.NotFoundException(`Employee ${id} not found`);
        return employee;
    }
    create(dto) {
        const id = dto.id || 'EMP-' + String(Date.now());
        const employee = { status: 'active', createdAt: new Date().toISOString(), ...dto, id };
        return this.repo.save(this.repo.create(employee));
    }
    async update(id, dto) {
        const employee = await this.findOne(id);
        Object.assign(employee, dto, { id });
        return this.repo.save(employee);
    }
    async remove(id) {
        const employee = await this.repo.findOneBy({ id });
        if (employee)
            await this.repo.remove(employee);
        return { id, deleted: true };
    }
};
exports.EmployeesService = EmployeesService;
exports.EmployeesService = EmployeesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], EmployeesService);
//# sourceMappingURL=employees.service.js.map