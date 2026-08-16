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
exports.TicketsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
let TicketsService = class TicketsService {
    constructor(repo) {
        this.repo = repo;
    }
    findAll() {
        return this.repo.find({ order: { createdAt: 'DESC' } });
    }
    create(dto) {
        const id = dto.id || 'TK-' + String(Date.now());
        const ticket = { status: 'Open', priority: 'Medium', category: 'General', createdAt: new Date().toISOString().slice(0, 10), ...dto, id };
        return this.repo.save(this.repo.create(ticket));
    }
    async update(id, dto) {
        let ticket = await this.repo.findOneBy({ id });
        if (!ticket)
            ticket = this.repo.create({ id, createdAt: new Date().toISOString().slice(0, 10) });
        Object.assign(ticket, dto, { id });
        return this.repo.save(ticket);
    }
    async remove(id) {
        const ticket = await this.repo.findOneBy({ id });
        if (ticket)
            await this.repo.remove(ticket);
        return { id, deleted: true };
    }
};
exports.TicketsService = TicketsService;
exports.TicketsService = TicketsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.TicketEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], TicketsService);
//# sourceMappingURL=tickets.service.js.map