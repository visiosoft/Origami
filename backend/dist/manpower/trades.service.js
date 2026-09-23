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
exports.TradesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const trades_1 = require("../seed-data/trades");
let TradesService = class TradesService {
    constructor(repo) {
        this.repo = repo;
        this.log = new common_1.Logger('TradesService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(trades_1.DEFAULT_TRADES);
                this.log.log(`Seeded ${trades_1.DEFAULT_TRADES.length} trades`);
            }
        }
        catch (err) {
            this.log.error('Trade seed failed: ' + err.message);
        }
    }
    findAll() {
        return this.repo.find({ order: { order: 'ASC' } });
    }
    create(dto) {
        const id = dto.id || 'TRD-' + String(Date.now());
        return this.repo.save(this.repo.create({ active: true, order: 0, ...dto, id }));
    }
    async update(id, dto) {
        const trade = await this.repo.findOneBy({ id });
        if (!trade)
            throw new common_1.NotFoundException(`Trade ${id} not found`);
        Object.assign(trade, dto, { id });
        return this.repo.save(trade);
    }
    async remove(id) {
        const trade = await this.repo.findOneBy({ id });
        if (trade)
            await this.repo.remove(trade);
        return { id, deleted: true };
    }
};
exports.TradesService = TradesService;
exports.TradesService = TradesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.TradeEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], TradesService);
//# sourceMappingURL=trades.service.js.map