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
exports.RolesService = exports.SITE_SUPER_TRIM_KEY = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const users_1 = require("../seed-data/users");
exports.SITE_SUPER_TRIM_KEY = 'roles.siteSuperTrimmed';
let RolesService = class RolesService {
    constructor(repo, settings) {
        this.repo = repo;
        this.settings = settings;
        this.log = new common_1.Logger('RolesService');
    }
    async onApplicationBootstrap() {
        try {
            const existing = new Set((await this.repo.find()).map((r) => r.key));
            const missing = users_1.DEFAULT_ROLES.filter((r) => !existing.has(r.key));
            if (missing.length) {
                await this.repo.save(missing);
                this.log.log(`Seeded ${missing.length} role(s)`);
            }
            await this.trimSiteSuper();
        }
        catch (err) {
            this.log.error('Roles seed failed: ' + err.message);
        }
    }
    async trimSiteSuper() {
        if (await this.settings.findOneBy({ key: exports.SITE_SUPER_TRIM_KEY }))
            return;
        const role = await this.repo.findOneBy({ key: 'site_super' });
        if (role) {
            role.permissions = users_1.SITE_SUPER_PERMISSIONS;
            await this.repo.save(role);
            this.log.log('Site Superintendent role trimmed to dashboard, projects, tasks and File Room');
        }
        await this.settings.save({ key: exports.SITE_SUPER_TRIM_KEY, value: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    findAll() {
        return this.repo.find({ order: { order: 'ASC' } });
    }
    create(dto) {
        const key = dto.key || 'role_' + Date.now();
        const role = { order: 999, isSystem: false, description: '', permissions: {}, ...dto, key };
        return this.repo.save(this.repo.create(role));
    }
    async update(key, dto) {
        let role = await this.repo.findOneBy({ key });
        if (!role)
            role = this.repo.create({ key });
        Object.assign(role, dto, { key });
        return this.repo.save(role);
    }
    async remove(key) {
        const role = await this.repo.findOneBy({ key });
        if (role?.isSystem)
            throw new common_1.NotFoundException(`Role ${key} is protected`);
        if (role)
            await this.repo.remove(role);
        return { key, deleted: true };
    }
};
exports.RolesService = RolesService;
exports.RolesService = RolesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.RoleEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.AppSettingEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], RolesService);
//# sourceMappingURL=roles.service.js.map