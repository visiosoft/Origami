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
exports.GuestAccessService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const auth_service_1 = require("../auth/auth.service");
const settings_service_1 = require("../settings/settings.service");
const people_service_1 = require("../people/people.service");
const crypto_util_1 = require("../auth/crypto.util");
const TOKEN_SIGNATURE_MAX_AGE_MS = 120 * 24 * 60 * 60_000;
const MIN_DAYS = 1;
const MAX_DAYS = 90;
const DEFAULT_DAYS = 10;
let GuestAccessService = class GuestAccessService {
    constructor(repo, users, projects, auth, settings, people) {
        this.repo = repo;
        this.users = users;
        this.projects = projects;
        this.auth = auth;
        this.settings = settings;
        this.people = people;
    }
    async list(projectId) {
        const rows = projectId
            ? await this.repo.find({ where: { projectId }, order: { id: 'DESC' } })
            : await this.repo.find({ order: { id: 'DESC' } });
        const out = [];
        for (const r of rows) {
            const user = await this.users.findOneBy({ id: r.userId });
            out.push({
                id: r.id,
                name: user?.name || '',
                email: user?.email || '',
                tier: user?.tier || '',
                projectId: r.projectId,
                createdAt: r.createdAt,
                expiresAt: r.expiresAt,
                createdBy: r.createdBy || '',
                revokedAt: r.revokedAt || '',
                lastUsedAt: r.lastUsedAt || '',
                expired: !r.revokedAt && Date.now() > Date.parse(r.expiresAt),
                hasFullAccount: !!user?.passwordHash,
            });
        }
        return out;
    }
    async create(input, actor) {
        const name = (input.name || '').trim();
        const email = (input.email || '').trim().toLowerCase();
        if (!name)
            throw new common_1.BadRequestException('Name is required.');
        if (!email || !email.includes('@'))
            throw new common_1.BadRequestException('A valid email is required.');
        if (input.tier !== 'client' && input.tier !== 'consultant') {
            throw new common_1.BadRequestException('Tier must be client or consultant.');
        }
        const project = await this.projects.findOneBy({ id: Number(input.projectId) });
        if (!project)
            throw new common_1.BadRequestException('Project not found.');
        const days = Math.min(MAX_DAYS, Math.max(MIN_DAYS, Number(input.days) || DEFAULT_DAYS));
        let user = await this.auth.findByEmail(email);
        if (user) {
            if (user.tier === 'internal') {
                throw new common_1.BadRequestException(`${email} already has a full internal account and doesn't need guest access.`);
            }
        }
        else {
            user = this.users.create({
                id: 'GUEST-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                name, email, tier: input.tier, roleKey: input.tier, status: 'active',
                createdAt: new Date().toISOString().slice(0, 10),
            });
            user = await this.users.save(user);
        }
        await this.people.linkToProject(email, name, input.tier === 'client' ? 'Client' : 'Consultant', project.name);
        const now = new Date();
        const grant = await this.repo.save(this.repo.create({
            userId: user.id,
            projectId: project.id,
            createdAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + days * 86_400_000).toISOString(),
            createdBy: actor?.name || 'System',
        }));
        const secret = await this.settings.jwtSecret();
        const base = (await this.settings.baseUrl()) || '';
        const token = (0, crypto_util_1.signState)({ mode: 'guest', grantId: grant.id }, secret);
        const link = `${base}/guest?token=${encodeURIComponent(token)}`;
        return { id: grant.id, name, email, tier: input.tier, projectId: project.id, projectName: project.name, expiresAt: grant.expiresAt, link };
    }
    async revoke(id) {
        const row = await this.repo.findOneBy({ id });
        if (!row)
            throw new common_1.BadRequestException('Grant not found.');
        row.revokedAt = new Date().toISOString();
        await this.repo.save(row);
        return { id, revokedAt: row.revokedAt };
    }
    async promote(id) {
        const row = await this.repo.findOneBy({ id });
        if (!row)
            throw new common_1.BadRequestException('Grant not found.');
        const user = await this.users.findOneBy({ id: row.userId });
        if (!user)
            throw new common_1.BadRequestException('That account no longer exists.');
        return this.auth.sendInvite(user, 'invite');
    }
    async resolveToken(token) {
        const secret = await this.settings.jwtSecret();
        const parsed = (0, crypto_util_1.readState)(token, secret, TOKEN_SIGNATURE_MAX_AGE_MS);
        const grantId = Number(parsed?.grantId);
        if (!parsed || parsed.mode !== 'guest' || !Number.isFinite(grantId)) {
            throw new common_1.ForbiddenException('This link is not valid.');
        }
        const grant = await this.repo.findOneBy({ id: grantId });
        if (!grant)
            throw new common_1.ForbiddenException('This link is no longer valid.');
        if (grant.revokedAt)
            throw new common_1.ForbiddenException('This access link has been revoked. Ask your project contact for a new one.');
        if (Date.now() > Date.parse(grant.expiresAt)) {
            throw new common_1.ForbiddenException('This access link has expired. Ask your project contact for a new one.');
        }
        const user = await this.users.findOneBy({ id: grant.userId });
        if (!user)
            throw new common_1.ForbiddenException('This account no longer exists.');
        grant.lastUsedAt = new Date().toISOString();
        await this.repo.save(grant);
        return this.auth.issueSession(user);
    }
};
exports.GuestAccessService = GuestAccessService;
exports.GuestAccessService = GuestAccessService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.GuestAccessEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        auth_service_1.AuthService,
        settings_service_1.SettingsService,
        people_service_1.PeopleService])
], GuestAccessService);
//# sourceMappingURL=guest-access.service.js.map