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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const users_1 = require("../seed-data/users");
let UsersService = class UsersService {
    constructor(repo) {
        this.repo = repo;
        this.log = new common_1.Logger('UsersService');
        this.mem = users_1.DEFAULT_USERS.map((u) => ({ ...u }));
    }
    async onApplicationBootstrap() {
        if (!this.repo)
            return;
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(users_1.DEFAULT_USERS);
                this.log.log(`Seeded ${users_1.DEFAULT_USERS.length} users`);
            }
        }
        catch (err) {
            this.log.error('Users seed failed: ' + err.message);
        }
    }
    async findAll() {
        if (!this.repo)
            return this.mem.slice();
        return this.repo.find({ order: { createdAt: 'DESC' } });
    }
    create(dto) {
        const id = dto.id || 'U-' + String(1000 + (Date.now() % 9000));
        const user = { status: 'active', tier: 'internal', createdAt: new Date().toISOString().slice(0, 10), ...dto, id };
        if (!this.repo) {
            this.mem = [user, ...this.mem];
            return user;
        }
        return this.repo.save(this.repo.create(user));
    }
    async update(id, dto) {
        if (!this.repo) {
            this.mem = this.mem.map((u) => (u.id === id ? { ...u, ...dto, id } : u));
            return this.mem.find((u) => u.id === id);
        }
        let user = await this.repo.findOneBy({ id });
        if (!user)
            user = this.repo.create({ id, createdAt: new Date().toISOString().slice(0, 10) });
        Object.assign(user, dto, { id });
        return this.repo.save(user);
    }
    async remove(id) {
        if (!this.repo) {
            this.mem = this.mem.filter((u) => u.id !== id);
            return { id, deleted: true };
        }
        const user = await this.repo.findOneBy({ id });
        if (user)
            await this.repo.remove(user);
        return { id, deleted: true };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], UsersService);
//# sourceMappingURL=users.service.js.map