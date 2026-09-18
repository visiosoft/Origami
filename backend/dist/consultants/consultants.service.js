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
exports.ConsultantsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const consultants_1 = require("../seed-data/consultants");
let ConsultantsService = class ConsultantsService {
    constructor(repo) {
        this.repo = repo;
        this.log = new common_1.Logger('ConsultantsService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(consultants_1.DEFAULT_CONSULTANTS);
                this.log.log(`Seeded ${consultants_1.DEFAULT_CONSULTANTS.length} consultants from the matrix`);
            }
        }
        catch (err) {
            this.log.error('Consultant seed failed: ' + err.message);
        }
    }
    findAll() {
        return this.repo.find({ order: { type: 'ASC', firm: 'ASC' } });
    }
    create(dto) {
        const id = dto.id || 'CONS-' + String(Date.now());
        const consultant = { type: '', firm: '', ...dto, id };
        return this.repo.save(this.repo.create(consultant));
    }
    async update(id, dto) {
        let consultant = await this.repo.findOneBy({ id });
        if (!consultant)
            consultant = this.repo.create({ id });
        Object.assign(consultant, dto, { id });
        return this.repo.save(consultant);
    }
    async remove(id) {
        const consultant = await this.repo.findOneBy({ id });
        if (consultant)
            await this.repo.remove(consultant);
        return { id, deleted: true };
    }
};
exports.ConsultantsService = ConsultantsService;
exports.ConsultantsService = ConsultantsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ConsultantEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ConsultantsService);
//# sourceMappingURL=consultants.service.js.map