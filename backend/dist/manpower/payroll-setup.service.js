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
exports.PayrollSetupService = exports.US_COMPONENTS = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const settings_service_1 = require("../settings/settings.service");
const payroll_calc_1 = require("./payroll.calc");
const workforce_util_1 = require("./workforce.util");
const SETTINGS_KEY = 'payroll.settings';
const LOCALE_KEY = 'hr.locale';
const c = (name, kind, calcType, defaultValue, category) => ({ name, kind, calcType, defaultValue, appliesTo: 'all', category, active: true });
exports.US_COMPONENTS = [
    c('Site allowance', 'earning', 'fixed', 0, 'allowance'),
    c('Per diem', 'earning', 'fixed', 0, 'allowance'),
    c('Tool allowance', 'earning', 'fixed', 0, 'allowance'),
    c('Vehicle / mileage allowance', 'earning', 'fixed', 0, 'allowance'),
    c('Federal income tax withholding', 'deduction', 'percent_gross', 0, 'tax'),
    c('Social Security (OASDI)', 'deduction', 'percent_gross', 6.2, 'social_security'),
    c('Medicare', 'deduction', 'percent_gross', 1.45, 'social_security'),
    c('State income tax', 'deduction', 'percent_gross', 0, 'tax'),
    c('State disability insurance (SDI)', 'deduction', 'percent_gross', 0, 'insurance'),
    c('401(k) contribution', 'deduction', 'percent_basic', 0, 'retirement'),
    c('Health insurance premium', 'deduction', 'fixed', 0, 'insurance'),
    c('Union dues', 'deduction', 'fixed', 0, 'other'),
];
const LEGACY_COMPONENTS = {
    'PC-01': { name: 'Site allowance', to: 'Site allowance' },
    'PC-02': { name: 'Travel allowance', to: 'Vehicle / mileage allowance' },
    'PC-03': { name: 'Food allowance', to: 'Per diem' },
    'PC-04': { name: 'Accommodation allowance', to: null },
    'PC-05': { name: 'Income tax', to: 'Federal income tax withholding' },
    'PC-06': { name: 'Social security (EOBI)', to: 'Social Security (OASDI)' },
    'PC-07': { name: 'Insurance', to: 'Health insurance premium' },
};
let PayrollSetupService = class PayrollSetupService {
    constructor(components, store) {
        this.components = components;
        this.store = store;
        this.log = new common_1.Logger('PayrollSetupService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.components.count()) === 0) {
                await this.components.save(exports.US_COMPONENTS.map((x, i) => ({ ...x, id: 'PC-US-' + String(i + 1).padStart(2, '0'), order: i })));
                this.log.log(`Seeded ${exports.US_COMPONENTS.length} pay components`);
            }
            await this.convertToUs();
        }
        catch (err) {
            this.log.error('Payroll setup failed: ' + err.message);
        }
    }
    async convertToUs() {
        if ((await this.store.get(LOCALE_KEY)) === 'US')
            return;
        const raw = await this.store.get(SETTINGS_KEY);
        if (raw) {
            let saved = {};
            try {
                saved = JSON.parse(raw);
            }
            catch {
                saved = {};
            }
            const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
            const L = payroll_calc_1.LEGACY_PAYROLL_SETTINGS, U = payroll_calc_1.DEFAULT_PAYROLL_SETTINGS;
            if (saved.currency === L.currency)
                saved.currency = U.currency;
            if (same(saved.weekendDays, L.weekendDays))
                saved.weekendDays = U.weekendDays;
            if (saved.monthDays === L.monthDays)
                saved.monthDays = U.monthDays;
            if (same(saved.otMultipliers, L.otMultipliers))
                saved.otMultipliers = U.otMultipliers;
            await this.store.set(SETTINGS_KEY, JSON.stringify(saved));
        }
        const rows = await this.components.find();
        for (const r of rows) {
            const legacy = LEGACY_COMPONENTS[r.id];
            if (!legacy || r.name !== legacy.name)
                continue;
            if (legacy.to === null) {
                if (!r.defaultValue)
                    r.active = false;
                continue;
            }
            const us = exports.US_COMPONENTS.find((x) => x.name === legacy.to);
            Object.assign(r, { name: us.name, calcType: us.calcType, appliesTo: 'all', category: us.category, defaultValue: r.defaultValue || us.defaultValue });
        }
        let order = rows.length;
        const add = exports.US_COMPONENTS.filter((x) => !rows.some((r) => r.name === x.name))
            .map((x) => this.components.create({ ...x, id: (0, workforce_util_1.newId)('PC'), order: order++ }));
        await this.components.save([...rows, ...add]);
        await this.store.set(LOCALE_KEY, 'US');
        this.log.log(`Payroll set up for the US: ${add.length} component(s) added`);
    }
    async settings() {
        const raw = await this.store.get(SETTINGS_KEY);
        let saved = {};
        try {
            saved = raw ? JSON.parse(raw) : {};
        }
        catch {
            saved = {};
        }
        return {
            ...payroll_calc_1.DEFAULT_PAYROLL_SETTINGS, ...saved,
            otMultipliers: { ...payroll_calc_1.DEFAULT_PAYROLL_SETTINGS.otMultipliers, ...(saved.otMultipliers || {}) },
        };
    }
    async saveSettings(patch) {
        const next = { ...(await this.settings()), ...patch, otMultipliers: { ...(await this.settings()).otMultipliers, ...(patch.otMultipliers || {}) } };
        const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
        if (!positive(next.standardDayHours) || next.standardDayHours > 24)
            throw new common_1.BadRequestException('A working day must be between 0 and 24 hours.');
        if (!positive(next.halfDayHours) || next.halfDayHours > next.standardDayHours)
            throw new common_1.BadRequestException('A half day must be more than 0 and no longer than a full day.');
        if (!positive(next.monthDays) || next.monthDays > 31)
            throw new common_1.BadRequestException('Days per month must be between 1 and 31.');
        for (const [k, v] of Object.entries(next.otMultipliers))
            if (!positive(v))
                throw new common_1.BadRequestException(`The ${k} overtime multiplier must be above 0.`);
        if (!next.currency?.trim())
            throw new common_1.BadRequestException('Set a currency.');
        if (!Array.isArray(next.weekendDays) || next.weekendDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
            throw new common_1.BadRequestException('Weekend days must be weekday numbers 0-6.');
        await this.store.set(SETTINGS_KEY, JSON.stringify(next));
        return next;
    }
    listComponents() {
        return this.components.find({ order: { order: 'ASC' } });
    }
    check(dto) {
        if (dto.kind && !['earning', 'deduction'].includes(dto.kind))
            throw new common_1.BadRequestException('Kind must be earning or deduction.');
        if (dto.calcType && !['fixed', 'percent_basic', 'percent_gross'].includes(dto.calcType))
            throw new common_1.BadRequestException('Unknown calculation type.');
        if (dto.kind === 'earning' && dto.calcType === 'percent_gross')
            throw new common_1.BadRequestException('An earning cannot be a percentage of gross -- gross includes it.');
        if (dto.defaultValue != null && (Number(dto.defaultValue) < 0 || !Number.isFinite(Number(dto.defaultValue))))
            throw new common_1.BadRequestException('The value cannot be negative.');
    }
    async createComponent(dto) {
        if (!dto.name?.trim())
            throw new common_1.BadRequestException('Name the component.');
        const row = { kind: 'earning', calcType: 'fixed', defaultValue: 0, appliesTo: 'all', active: true, order: await this.components.count(), ...dto };
        this.check(row);
        return this.components.save(this.components.create({ ...row, id: (0, workforce_util_1.newId)('PC') }));
    }
    async updateComponent(id, dto) {
        const c = await this.components.findOneBy({ id });
        if (!c)
            throw new common_1.NotFoundException('Pay component not found');
        const next = { ...c, ...dto, id };
        this.check(next);
        return this.components.save(next);
    }
    async removeComponent(id) {
        const c = await this.components.findOneBy({ id });
        if (c)
            await this.components.remove(c);
        return { id, deleted: true };
    }
};
exports.PayrollSetupService = PayrollSetupService;
exports.PayrollSetupService = PayrollSetupService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.PayComponentEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        settings_service_1.SettingsService])
], PayrollSetupService);
//# sourceMappingURL=payroll-setup.service.js.map