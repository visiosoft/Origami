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
const auth_service_1 = require("../auth/auth.service");
let UsersService = class UsersService {
    constructor(repo, projectTasks, tasks, auth) {
        this.repo = repo;
        this.projectTasks = projectTasks;
        this.tasks = tasks;
        this.auth = auth;
        this.log = new common_1.Logger('UsersService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(users_1.DEFAULT_USERS);
                this.log.log(`Seeded ${users_1.DEFAULT_USERS.length} users`);
            }
            await this.auth.ensureBootstrapAdmin();
        }
        catch (err) {
            this.log.error('Users seed failed: ' + err.message);
        }
    }
    async findAll() {
        const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
        return rows.map(auth_service_1.publicUser);
    }
    async create(dto) {
        const id = dto.id || 'U-' + String(1000 + (Date.now() % 9000));
        const user = this.repo.create({
            status: 'pending',
            tier: 'internal',
            createdAt: new Date().toISOString().slice(0, 10),
            ...dto,
            id,
            email: String(dto.email || '').trim(),
        });
        const saved = await this.repo.save(user);
        let invite = { sent: false };
        try {
            invite = await this.auth.sendInvite(saved, 'invite');
        }
        catch (err) {
            invite = { sent: false, error: err.message };
            this.log.warn(`Could not invite ${saved.email}: ${err.message}`);
        }
        return { ...(0, auth_service_1.publicUser)(saved), invite };
    }
    async resendInvite(id) {
        const user = await this.repo.findOneBy({ id });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const invite = await this.auth.sendInvite(user, user.passwordHash ? 'reset' : 'invite');
        return { ...(0, auth_service_1.publicUser)(user), invite };
    }
    async update(id, dto) {
        let user = await this.repo.findOneBy({ id });
        if (!user)
            user = this.repo.create({ id, createdAt: new Date().toISOString().slice(0, 10) });
        const previousName = user.name;
        const { passwordHash, inviteToken, hasPassword, invitePending, invite, ...safe } = dto ?? {};
        Object.assign(user, safe, { id });
        const saved = await this.repo.save(user);
        if (previousName && saved.name && previousName !== saved.name) {
            await this.renameOnTasks(saved.id, saved.name);
        }
        return (0, auth_service_1.publicUser)(saved);
    }
    async renameOnTasks(userId, name) {
        try {
            await this.projectTasks.update({ assigneeId: userId }, { assignee: name });
            await this.tasks.update({ assignedToId: userId }, { assignedTo: name });
        }
        catch (err) {
            this.log.warn(`Could not propagate the rename of ${userId}: ${err.message}`);
        }
    }
    async remove(id) {
        const user = await this.repo.findOneBy({ id });
        if (user)
            await this.repo.remove(user);
        return { id, deleted: true };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ProjectTaskEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.TaskEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        auth_service_1.AuthService])
], UsersService);
//# sourceMappingURL=users.service.js.map