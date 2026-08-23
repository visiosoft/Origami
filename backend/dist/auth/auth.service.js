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
exports.AuthService = void 0;
exports.publicUser = publicUser;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const settings_service_1 = require("../settings/settings.service");
const google_service_1 = require("../google/google.service");
const email_templates_1 = require("./email.templates");
const shell_1 = require("../email/shell");
const users_1 = require("../seed-data/users");
const crypto_util_1 = require("./crypto.util");
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const INVITE_TTL_DAYS = 7;
const RESET_TTL_HOURS = 2;
function publicUser(u) {
    const { passwordHash, inviteToken, ...rest } = u;
    return { ...rest, hasPassword: !!passwordHash, invitePending: !!inviteToken };
}
let AuthService = class AuthService {
    constructor(users, roles, settings, google) {
        this.users = users;
        this.roles = roles;
        this.settings = settings;
        this.google = google;
        this.log = new common_1.Logger('AuthService');
    }
    async ensureFounderAdmin() {
        const existing = await this.findByEmail(users_1.FOUNDER_ADMIN.email);
        if (existing)
            return;
        await this.users.save(this.users.create({
            ...users_1.FOUNDER_ADMIN,
            passwordSetAt: new Date().toISOString(),
            createdAt: new Date().toISOString().slice(0, 10),
        }));
        this.log.warn(`Created founding admin ${users_1.FOUNDER_ADMIN.email} — change its password after first sign-in.`);
    }
    async ensureBootstrapAdmin() {
        await this.ensureFounderAdmin();
        const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim();
        const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
        if (!email || !password)
            return;
        if ((0, crypto_util_1.passwordProblem)(password)) {
            this.log.warn('BOOTSTRAP_ADMIN_PASSWORD is too weak — skipping bootstrap admin.');
            return;
        }
        let user = await this.findByEmail(email);
        if (!user) {
            user = this.users.create({
                id: 'U-ADMIN',
                name: email.split('@')[0],
                email,
                tier: 'internal',
                roleKey: 'admin',
                status: 'active',
                createdAt: new Date().toISOString().slice(0, 10),
            });
        }
        user.passwordHash = (0, crypto_util_1.hashPassword)(password);
        user.passwordSetAt = new Date().toISOString();
        user.status = 'active';
        await this.users.save(user);
        this.log.warn(`Bootstrap admin ready: ${email} — remove BOOTSTRAP_ADMIN_* once you've signed in.`);
    }
    async sendInvite(user, kind = 'invite') {
        const token = (0, crypto_util_1.randomToken)();
        const ttlMs = kind === 'invite' ? INVITE_TTL_DAYS * 864e5 : RESET_TTL_HOURS * 36e5;
        user.inviteToken = (0, crypto_util_1.hashToken)(token);
        user.inviteSentAt = new Date().toISOString();
        user.inviteExpiresAt = new Date(Date.now() + ttlMs).toISOString();
        await this.users.save(user);
        const base = await this.settings.baseUrl();
        if (!base) {
            throw new common_1.BadRequestException('App base URL is not set. Add it under Settings -> Integrations -> Google Workspace before inviting users.');
        }
        const url = `${base}/set-password?token=${encodeURIComponent(token)}`;
        const role = await this.roles.findOneBy({ key: user.roleKey });
        const brand = await (0, shell_1.loadEmailBrand)(this.settings);
        const mail = kind === 'invite'
            ? (0, email_templates_1.inviteEmail)({ name: user.name, url, roleName: role?.name || user.roleKey || 'team member', expiresInDays: INVITE_TTL_DAYS, brand })
            : (0, email_templates_1.resetEmail)({ name: user.name, url, expiresInHours: RESET_TTL_HOURS, brand });
        try {
            await this.google.sendMail({ to: user.email, subject: mail.subject, html: mail.html });
            return { sent: true, to: user.email, url };
        }
        catch (err) {
            this.log.warn(`Invite email to ${user.email} could not be sent: ${err.message}`);
            return { sent: false, to: user.email, url, error: err.message };
        }
    }
    async readInvite(token) {
        const user = await this.users.findOneBy({ inviteToken: (0, crypto_util_1.hashToken)(token) });
        if (!user)
            throw new common_1.BadRequestException('This link is not valid. Ask an administrator for a new invitation.');
        if (user.inviteExpiresAt && new Date(user.inviteExpiresAt).getTime() < Date.now()) {
            throw new common_1.BadRequestException('This link has expired. Ask an administrator to send a new invitation.');
        }
        return { name: user.name, email: user.email, isReset: !!user.passwordHash };
    }
    async setPassword(token, password) {
        const problem = (0, crypto_util_1.passwordProblem)(password);
        if (problem)
            throw new common_1.BadRequestException(problem);
        const user = await this.users.findOneBy({ inviteToken: (0, crypto_util_1.hashToken)(token) });
        if (!user)
            throw new common_1.BadRequestException('This link is not valid. Ask an administrator for a new invitation.');
        if (user.inviteExpiresAt && new Date(user.inviteExpiresAt).getTime() < Date.now()) {
            throw new common_1.BadRequestException('This link has expired. Ask an administrator to send a new invitation.');
        }
        user.passwordHash = (0, crypto_util_1.hashPassword)(password);
        user.passwordSetAt = new Date().toISOString();
        user.inviteToken = null;
        user.inviteExpiresAt = null;
        if (user.status === 'pending')
            user.status = 'active';
        await this.users.save(user);
        this.log.log(`Password set for ${user.email}`);
        return { ok: true, email: user.email };
    }
    async forgotPassword(email) {
        const canSend = (await this.google.isConnected()) && !!(await this.settings.baseUrl());
        if (!canSend) {
            this.log.warn('Password reset requested but no mailbox is connected.');
            return { ok: false, reason: 'unavailable' };
        }
        const user = await this.findByEmail(email);
        if (user && user.status !== 'suspended') {
            try {
                await this.sendInvite(user, 'reset');
            }
            catch (err) {
                this.log.warn(`Reset email to ${email} failed: ${err.message}`);
            }
        }
        return { ok: true };
    }
    async login(email, password) {
        const user = await this.findByEmail(email);
        if (!user || !(0, crypto_util_1.verifyPassword)(password, user.passwordHash)) {
            throw new common_1.UnauthorizedException('Email or password is incorrect.');
        }
        return this.issueSession(user);
    }
    async loginWithGoogle(profile) {
        if (!profile.email)
            throw new common_1.UnauthorizedException('Google did not return an email address.');
        const user = await this.findByEmail(profile.email);
        if (!user) {
            throw new common_1.UnauthorizedException(`No Origami account exists for ${profile.email}. Ask an administrator to invite you first.`);
        }
        if (!user.googleId)
            user.googleId = profile.sub;
        if (profile.picture)
            user.avatarUrl = profile.picture;
        if (user.status === 'pending') {
            user.status = 'active';
            user.inviteToken = null;
            user.inviteExpiresAt = null;
        }
        await this.users.save(user);
        return this.issueSession(user);
    }
    async issueSession(user) {
        if (user.status === 'suspended')
            throw new common_1.UnauthorizedException('This account is suspended.');
        if (user.status === 'pending') {
            throw new common_1.UnauthorizedException('This account is not active yet — use the invitation link to set a password.');
        }
        user.lastLogin = new Date().toISOString();
        await this.users.save(user);
        const secret = await this.settings.jwtSecret();
        const token = (0, crypto_util_1.signJwt)({ sub: user.id, email: user.email, name: user.name, roleKey: user.roleKey, tier: user.tier }, secret, SESSION_TTL_SECONDS);
        return { token, expiresIn: SESSION_TTL_SECONDS, user: publicUser(user) };
    }
    async verify(bearer) {
        const raw = bearer?.startsWith('Bearer ') ? bearer.slice(7) : bearer;
        if (!raw)
            return null;
        return (0, crypto_util_1.verifyJwt)(raw, await this.settings.jwtSecret());
    }
    async actor(bearer) {
        const claims = await this.verify(bearer);
        return claims ? { name: claims.name, id: claims.sub } : { name: 'Unknown' };
    }
    async requireActor(bearer) {
        const claims = await this.verify(bearer);
        if (!claims)
            throw new common_1.UnauthorizedException('Sign in to upload files.');
        return { name: claims.name, id: claims.sub };
    }
    async me(bearer) {
        const claims = await this.verify(bearer);
        if (!claims)
            throw new common_1.UnauthorizedException('Not signed in.');
        const user = await this.users.findOneBy({ id: claims.sub });
        if (!user)
            throw new common_1.UnauthorizedException('Not signed in.');
        return publicUser(user);
    }
    async setNotificationPrefs(bearer, notifyOnAssignment) {
        const claims = await this.verify(bearer);
        if (!claims)
            throw new common_1.UnauthorizedException('Not signed in.');
        const user = await this.users.findOneBy({ id: claims.sub });
        if (!user)
            throw new common_1.UnauthorizedException('Not signed in.');
        user.notifyOnAssignment = notifyOnAssignment;
        await this.users.save(user);
        return publicUser(user);
    }
    findByEmail(email) {
        return this.users
            .createQueryBuilder('u')
            .where('LOWER(u.email) = :email', { email: (email || '').trim().toLowerCase() })
            .getOne();
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.RoleEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        settings_service_1.SettingsService,
        google_service_1.GoogleService])
], AuthService);
//# sourceMappingURL=auth.service.js.map