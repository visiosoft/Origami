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
exports.LeaveRequestsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
let LeaveRequestsService = class LeaveRequestsService {
    constructor(repo) {
        this.repo = repo;
    }
    findAll(opts) {
        const where = {};
        if (opts.employeeId)
            where.employeeId = opts.employeeId;
        if (opts.status)
            where.status = opts.status;
        return this.repo.find({ where, order: { requestedAt: 'DESC' } });
    }
    create(dto, actor) {
        const id = dto.id || 'LR-' + String(Date.now());
        const request = {
            status: 'pending', requestedBy: actor.name, requestedAt: new Date().toISOString(),
            ...dto, id,
        };
        return this.repo.save(this.repo.create(request));
    }
    async decide(id, decision, note, actor) {
        const request = await this.repo.findOneBy({ id });
        if (!request)
            throw new common_1.NotFoundException(`Leave request ${id} not found`);
        if (request.status !== 'pending')
            throw new common_1.BadRequestException(`This request has already been ${request.status}.`);
        request.status = decision;
        request.decidedBy = actor.name;
        request.decidedAt = new Date().toISOString();
        request.note = note || '';
        return this.repo.save(request);
    }
    async remove(id) {
        const request = await this.repo.findOneBy({ id });
        if (request)
            await this.repo.remove(request);
        return { id, deleted: true };
    }
};
exports.LeaveRequestsService = LeaveRequestsService;
exports.LeaveRequestsService = LeaveRequestsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.LeaveRequestEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], LeaveRequestsService);
//# sourceMappingURL=leave-requests.service.js.map