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
exports.RolesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const users_1 = require("../seed-data/users");
let RolesService = class RolesService {
    constructor(repo) {
        this.repo = repo;
        this.log = new common_1.Logger('RolesService');
        this.mem = users_1.DEFAULT_ROLES.map((r) => ({ ...r }));
    }
    async onApplicationBootstrap() {
        if (!this.repo)
            return;
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(users_1.DEFAULT_ROLES);
                this.log.log(`Seeded ${users_1.DEFAULT_ROLES.length} roles`);
            }
        }
        catch (err) {
            this.log.error('Roles seed failed: ' + err.message);
        }
    }
    async findAll() {
        if (this.repo) {
            try {
                return await this.repo.find({ order: { order: 'ASC' } });
            }
            catch (err) {
                this.log.error('roles.find failed, using seed: ' + err.message);
            }
        }
        return this.mem.slice().sort((a, b) => a.order - b.order);
    }
    create(dto) {
        const key = dto.key || 'role_' + Date.now();
        const role = { order: 999, isSystem: false, description: '', permissions: {}, ...dto, key };
        if (!this.repo) {
            this.mem = [...this.mem, role];
            return role;
        }
        return this.repo.save(this.repo.create(role));
    }
    async update(key, dto) {
        if (!this.repo) {
            this.mem = this.mem.map((r) => (r.key === key ? { ...r, ...dto, key } : r));
            return this.mem.find((r) => r.key === key);
        }
        let role = await this.repo.findOneBy({ key });
        if (!role)
            role = this.repo.create({ key });
        Object.assign(role, dto, { key });
        return this.repo.save(role);
    }
    async remove(key) {
        if (!this.repo) {
            const role = this.mem.find((r) => r.key === key);
            if (role?.isSystem)
                throw new common_1.NotFoundException(`Role ${key} is protected`);
            this.mem = this.mem.filter((r) => r.key !== key);
            return { key, deleted: true };
        }
        const role = await this.repo.findOneBy({ key });
        if (role && !role.isSystem)
            await this.repo.remove(role);
        return { key, deleted: true };
    }
};
exports.RolesService = RolesService;
exports.RolesService = RolesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.RoleEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], RolesService);
//# sourceMappingURL=roles.service.js.map