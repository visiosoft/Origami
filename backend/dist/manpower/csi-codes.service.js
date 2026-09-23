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
exports.CsiCodesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const csi_codes_1 = require("../seed-data/csi-codes");
let CsiCodesService = class CsiCodesService {
    constructor(repo) {
        this.repo = repo;
        this.log = new common_1.Logger('CsiCodesService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(csi_codes_1.DEFAULT_CSI_CODES);
                this.log.log(`Seeded ${csi_codes_1.DEFAULT_CSI_CODES.length} CSI codes`);
            }
        }
        catch (err) {
            this.log.error('CSI code seed failed: ' + err.message);
        }
    }
    findAll() {
        return this.repo.find({ order: { order: 'ASC' } });
    }
    create(dto) {
        const id = dto.id || 'CSI-' + String(Date.now());
        const csiCode = { active: true, order: 0, ...dto, id };
        return this.repo.save(this.repo.create(csiCode));
    }
    async update(id, dto) {
        const csiCode = await this.repo.findOneBy({ id });
        if (!csiCode)
            throw new common_1.NotFoundException(`CSI code ${id} not found`);
        Object.assign(csiCode, dto, { id });
        return this.repo.save(csiCode);
    }
    async remove(id) {
        const csiCode = await this.repo.findOneBy({ id });
        if (csiCode)
            await this.repo.remove(csiCode);
        return { id, deleted: true };
    }
};
exports.CsiCodesService = CsiCodesService;
exports.CsiCodesService = CsiCodesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.CsiCodeEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], CsiCodesService);
//# sourceMappingURL=csi-codes.service.js.map