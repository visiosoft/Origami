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
exports.EmployeesService = exports.nextWorkerId = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const attachments_service_1 = require("../google/attachments.service");
const staff_directory_sync_1 = require("./staff-directory.sync");
const workforce_util_1 = require("./workforce.util");
Object.defineProperty(exports, "nextWorkerId", { enumerable: true, get: function () { return workforce_util_1.nextWorkerId; } });
let EmployeesService = class EmployeesService {
    constructor(repo, trades, attachments, assignments, staff) {
        this.repo = repo;
        this.trades = trades;
        this.attachments = attachments;
        this.assignments = assignments;
        this.staff = staff;
    }
    async toPeople(e) {
        try {
            await this.staff?.syncEmployee(e);
        }
        catch { }
        return e;
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
    async withTradeName(dto) {
        if (!dto.tradeId)
            return dto;
        const trade = await this.trades.findOneBy({ id: dto.tradeId });
        return trade ? { ...dto, trade: trade.name } : dto;
    }
    async create(dto) {
        if (!dto.name?.trim())
            throw new common_1.BadRequestException('A name is required.');
        const all = await this.repo.find({ select: { workerId: true } });
        const now = new Date().toISOString();
        const employee = {
            status: 'active', employmentStatus: 'active', createdAt: now, updatedAt: now,
            ...(await this.withTradeName(dto)),
            workerId: dto.workerId?.trim() || (0, workforce_util_1.nextWorkerId)(all.map((e) => e.workerId), dto.hireDate),
            id: dto.id || 'EMP-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
        };
        return this.toPeople(await this.repo.save(this.repo.create(employee)));
    }
    async update(id, dto) {
        const employee = await this.findOne(id);
        const { photo: _ignored, ...rest } = await this.withTradeName(dto);
        if (rest.payComponents) {
            rest.payComponents = rest.payComponents.map((c) => {
                const value = Number(c?.value);
                if (!c?.componentId || !Number.isFinite(value) || value < 0)
                    throw new common_1.BadRequestException('Each pay component needs a value of 0 or more.');
                return { componentId: String(c.componentId), value };
            });
        }
        if (rest.overtimeRate != null && !(Number(rest.overtimeRate) > 0))
            throw new common_1.BadRequestException('An overtime rate must be above 0 -- clear it to use their normal hourly rate.');
        if (rest.payRate != null && !(Number(rest.payRate) >= 0))
            throw new common_1.BadRequestException('The pay rate cannot be negative.');
        Object.assign(employee, rest, { id, updatedAt: new Date().toISOString() });
        if (rest.employmentStatus)
            employee.status = rest.employmentStatus === 'active' ? 'active' : 'inactive';
        return this.toPeople(await this.repo.save(employee));
    }
    async remove(id) {
        const employee = await this.repo.findOneBy({ id });
        if (employee && (await this.assignments.count({ where: { employeeId: id } }))) {
            throw new common_1.BadRequestException(`${employee.name} has deployment history -- set their status to Resigned, Terminated or Demobilized instead of deleting.`);
        }
        if (employee) {
            await this.attachments.discard(employee.photo ?? undefined);
            await this.repo.remove(employee);
            await this.staff?.removeEmployee(id);
        }
        return { id, deleted: true };
    }
    async setPhoto(id, files, actor) {
        const employee = await this.findOne(id);
        const image = files?.[0];
        if (!image?.mimetype?.startsWith('image/'))
            throw new common_1.BadRequestException('The photo must be an image.');
        const [uploaded] = await this.attachments.upload([image], 'Employee Photos', actor);
        await this.attachments.discard(employee.photo ?? undefined);
        employee.photo = uploaded;
        employee.updatedAt = new Date().toISOString();
        return this.repo.save(employee);
    }
    async photo(id) {
        const employee = await this.findOne(id);
        if (!employee.photo)
            throw new common_1.NotFoundException('No photo on file');
        return employee.photo;
    }
};
exports.EmployeesService = EmployeesService;
exports.EmployeesService = EmployeesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.SubcontractorTradeEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.EmployeeAssignmentEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        attachments_service_1.AttachmentsService,
        typeorm_2.Repository,
        staff_directory_sync_1.StaffDirectorySync])
], EmployeesService);
//# sourceMappingURL=employees.service.js.map