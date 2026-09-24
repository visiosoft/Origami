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
exports.SubcontractorTradesService = exports.WORKER_TRADE_CODE = exports.SUBTRADE_CATEGORIES = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const subcontractor_trades_1 = require("../seed-data/subcontractor-trades");
const trades_1 = require("../seed-data/trades");
const manpower_access_service_1 = require("./manpower-access.service");
exports.SUBTRADE_CATEGORIES = ['general_engineering', 'general_building', 'specialty', 'limited_specialty', 'other'];
exports.WORKER_TRADE_CODE = {
    Mason: 'C-29', Carpenter: 'C-5', Electrician: 'C-10', Plumber: 'C-36', Welder: 'C-60', 'Steel Fixer': 'C-50',
    Painter: 'C-33', Scaffolder: 'D-39', 'Equipment Operator': 'C-12',
};
let SubcontractorTradesService = class SubcontractorTradesService {
    constructor(repo, contractors, employees, assignments, requests, oldTrades, access) {
        this.repo = repo;
        this.contractors = contractors;
        this.employees = employees;
        this.assignments = assignments;
        this.requests = requests;
        this.oldTrades = oldTrades;
        this.access = access;
        this.log = new common_1.Logger('SubcontractorTradesService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(subcontractor_trades_1.DEFAULT_SUBCONTRACTOR_TRADES);
                this.log.log(`Seeded ${subcontractor_trades_1.DEFAULT_SUBCONTRACTOR_TRADES.length} subcontractor trades`);
            }
            await this.migrateWorkerTrades();
        }
        catch (err) {
            this.log.error('Subcontractor trade setup failed: ' + err.message);
        }
    }
    async migrateWorkerTrades() {
        const current = await this.repo.find();
        const isNew = new Set(current.map((t) => t.id));
        const byCode = new Map(current.map((t) => [t.code, t]));
        const oldName = new Map(trades_1.DEFAULT_TRADES.map((t) => [t.id, t.name]));
        for (const t of await this.oldTrades.find().catch(() => []))
            oldName.set(t.id, t.name);
        const target = (oldId) => byCode.get(exports.WORKER_TRADE_CODE[oldName.get(oldId) || ''] || '');
        const stale = (id) => !!id && !isNew.has(id);
        const emps = (await this.employees.find()).filter((e) => stale(e.tradeId));
        for (const e of emps) {
            const t = target(e.tradeId);
            e.trade = t ? t.name : oldName.get(e.tradeId) || e.trade;
            e.tradeId = (t?.id ?? null);
        }
        if (emps.length)
            await this.employees.save(emps, { chunk: 40 });
        const asg = (await this.assignments.find()).filter((a) => stale(a.tradeId));
        for (const a of asg)
            a.tradeId = (target(a.tradeId)?.id ?? null);
        if (asg.length)
            await this.assignments.save(asg, { chunk: 40 });
        const reqs = (await this.requests.find()).filter((r) => (r.lines || []).some((l) => stale(l.tradeId)));
        for (const r of reqs) {
            r.lines = r.lines.map((l) => {
                if (!stale(l.tradeId))
                    return l;
                const t = target(l.tradeId);
                return { ...l, tradeId: t?.id || '', designation: l.designation || oldName.get(l.tradeId) };
            });
        }
        if (reqs.length)
            await this.requests.save(reqs, { chunk: 40 });
        if (emps.length + asg.length + reqs.length)
            this.log.log(`Moved worker trades onto classifications: ${emps.length} employees, ${asg.length} assignments, ${reqs.length} requests`);
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
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'change trades');
        if (!dto.code?.trim() || !dto.name?.trim())
            throw new common_1.BadRequestException('A code and a name are required.');
        await this.check(dto);
        return this.repo.save(this.repo.create({
            category: 'other', active: true, order: await this.repo.count(), ...dto, name: dto.name.trim(),
            id: 'SCT-' + dto.code.replace(/[^A-Z0-9-]/g, ''),
        }));
    }
    async update(id, dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'change trades');
        const t = await this.repo.findOneBy({ id });
        if (!t)
            throw new common_1.NotFoundException('Trade not found');
        await this.check(dto, id);
        Object.assign(t, dto, { id, name: dto.name?.trim() ?? t.name });
        return this.repo.save(t);
    }
    async remove(id, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'change trades');
        const companies = (await this.contractors.find()).filter((c) => (c.tradeIds || []).includes(id));
        const workers = await this.employees.count({ where: { tradeId: id } });
        if (companies.length || workers) {
            const who = [companies.length && `${companies.length} contractor(s)`, workers && `${workers} worker(s)`].filter(Boolean).join(' and ');
            throw new common_1.BadRequestException(`${who} use this trade -- make it inactive instead.`);
        }
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
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.EmployeeAssignmentEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.WorkforceRequestEntity)),
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.TradeEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        manpower_access_service_1.ManpowerAccess])
], SubcontractorTradesService);
//# sourceMappingURL=subcontractor-trades.service.js.map