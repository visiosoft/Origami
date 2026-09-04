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
exports.SettingsService = exports.MASK = exports.PUBLIC_KEYS = exports.SECRET_KEYS = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const entities_1 = require("../database/entities");
exports.SECRET_KEYS = ['google.clientSecret', 'google.refreshToken', 'auth.jwtSecret', 'reminders.triggerToken', 'sms.authToken'];
exports.PUBLIC_KEYS = [
    'google.clientId',
    'google.clientSecret',
    'app.baseUrl',
    'google.senderEmail',
    'google.allowSignup',
    'google.hostedDomain',
    'google.attachmentsFolder',
    'reminders.enabled',
    'reminders.hour',
    'reminders.timezone',
    'reminders.triggerToken',
    'tasks.labels',
    'notifications.assignmentEmail',
    'pipeline.slaDays',
    'programme.template',
    'sms.enabled',
    'sms.accountSid',
    'sms.authToken',
    'sms.fromNumber',
    'brand.companyName',
    'brand.tagline',
    'brand.logoDataUrl',
    'brand.accentColor',
    'brand.address',
    'brand.phone',
    'brand.email',
    'brand.website',
    'brand.footerNote',
    'brand.signatureName',
    'brand.signatureTitle',
    'brand.signatureDataUrl',
];
exports.MASK = '••••••••';
let SettingsService = class SettingsService {
    constructor(repo) {
        this.repo = repo;
        this.log = new common_1.Logger('SettingsService');
    }
    async get(key) {
        const row = await this.repo.findOneBy({ key });
        return row?.value ?? null;
    }
    async getMany(keys) {
        const out = {};
        for (const key of keys) {
            const v = await this.get(key);
            if (v != null)
                out[key] = v;
        }
        return out;
    }
    async set(key, value) {
        let row = await this.repo.findOneBy({ key });
        if (!row)
            row = this.repo.create({ key });
        row.value = value ?? '';
        row.updatedAt = new Date().toISOString();
        await this.repo.save(row);
    }
    async setMany(patch) {
        for (const [key, value] of Object.entries(patch)) {
            if (!exports.PUBLIC_KEYS.includes(key))
                continue;
            if (exports.SECRET_KEYS.includes(key) && (value === exports.MASK || value === ''))
                continue;
            await this.set(key, value == null ? '' : String(value));
        }
    }
    async publicView() {
        const raw = await this.getMany(exports.PUBLIC_KEYS);
        const out = {};
        for (const key of exports.PUBLIC_KEYS) {
            const v = raw[key] ?? '';
            out[key] = exports.SECRET_KEYS.includes(key) ? (v ? exports.MASK : '') : v;
        }
        return out;
    }
    async baseUrl() {
        const configured = (await this.get('app.baseUrl')) || process.env.APP_BASE_URL || '';
        return configured.replace(/\/+$/, '');
    }
    async jwtSecret() {
        let secret = await this.get('auth.jwtSecret');
        if (!secret) {
            secret = (0, crypto_1.randomBytes)(48).toString('hex');
            await this.set('auth.jwtSecret', secret);
            this.log.log('Generated a new session signing secret');
        }
        return secret;
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.AppSettingEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SettingsService);
//# sourceMappingURL=settings.service.js.map