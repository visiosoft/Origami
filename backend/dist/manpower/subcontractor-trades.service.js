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
exports.SubcontractorTradesService = exports.SUBTRADE_CATEGORIES = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const subcontractor_trades_1 = require("../seed-data/subcontractor-trades");
const manpower_access_service_1 = require("./manpower-access.service");
exports.SUBTRADE_CATEGORIES = ['general_engineering', 'general_building', 'specialty', 'limited_specialty', 'other'];
let SubcontractorTradesService = class SubcontractorTradesService {
    constructor(repo, contractors, access) {
        this.repo = repo;
        this.contractors = contractors;
        this.access = access;
        this.log = new common_1.Logger('SubcontractorTradesService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(subcontractor_trades_1.DEFAULT_SUBCONTRACTOR_TRADES);
                this.log.log(`Seeded ${subcontractor_trades_1.DEFAULT_SUBCONTRACTOR_TRADES.length} subcontractor trades`);
            }
        }
        catch (err) {
            this.log.error('Subcontractor trade seed failed: ' + err.message);
        }
    }
    findAll() {
        return this.repo.find({ order: { order: 'ASC' } });
    }
    async check(dto, id) {
        if (dto.category && !exports.SUBTRADE_CATEGORIES.includes(dto.category))
            throw new common_1.BadRequestException('Unknown category.');
        if (dto.code !== undefined) {
            const code = dto.code.trim().toUpperCase();
            if (!code)
                throw new common_1.BadRequestException('Give the trade a code, e.g. C-10.');
            const clash = (await this.repo.find()).find((t) => t.code.toUpperCase() === code && t.id !== id);
            if (clash)
                throw new common_1.BadRequestException(`${code} is already ${clash.name}.`);
            dto.code = code;
        }
        if (dto.name !== undefined && !dto.name.trim())
            throw new common_1.BadRequestException('Name the trade.');
    }
    async create(dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'change subcontractor trades');
        if (!dto.code?.trim() || !dto.name?.trim())
            throw new common_1.BadRequestException('A code and a name are required.');
        await this.check(dto);
        return this.repo.save(this.repo.create({
            category: 'other', active: true, order: await this.repo.count(), ...dto, name: dto.name.trim(),
            id: 'SCT-' + dto.code.replace(/[^A-Z0-9-]/g, ''),
        }));
    }
    async update(id, dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'change subcontractor trades');
        const t = await this.repo.findOneBy({ id });
        if (!t)
            throw new common_1.NotFoundException('Trade not found');
        await this.check(dto, id);
        Object.assign(t, dto, { id, name: dto.name?.trim() ?? t.name });
        return this.repo.save(t);
    }
    async remove(id, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'change subcontractor trades');
        const using = (await this.contractors.find()).filter((c) => (c.tradeIds || []).includes(id));
        if (using.length)
            throw new common_1.BadRequestException(`${using.map((c) => c.companyName).join(', ')} hold this classification -- make it inactive instead.`);
        const t = await this.repo.findOneBy({ id });
        if (t)
            await this.repo.remove(t);
        return { id, deleted: true };
    }
};
exports.SubcontractorTradesService = SubcontractorTradesService;
exports.SubcontractorTradesService = SubcontractorTradesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.SubcontractorTradeEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ContractorEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        manpower_access_service_1.ManpowerAccess])
], SubcontractorTradesService);
//# sourceMappingURL=subcontractor-trades.service.js.map