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
exports.GuestAccessController = void 0;
const common_1 = require("@nestjs/common");
const guest_access_service_1 = require("./guest-access.service");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const public_decorator_1 = require("../auth/guards/public.decorator");
const google_service_1 = require("../google/google.service");
const settings_service_1 = require("../settings/settings.service");
const letterhead_1 = require("../documents/letterhead");
let GuestAccessController = class GuestAccessController {
    constructor(service, google, settings) {
        this.service = service;
        this.google = google;
        this.settings = settings;
    }
    list(projectId) {
        return this.service.list(projectId ? Number(projectId) : undefined);
    }
    async create(body, req) {
        const grant = await this.service.create(body, { id: req.claims?.sub, name: req.claims?.name });
        try {
            const brand = (0, letterhead_1.brandingFrom)(await this.settings.getMany(letterhead_1.BRAND_KEYS));
            const days = Math.round((Date.parse(grant.expiresAt) - Date.now()) / 86_400_000);
            const html = (0, letterhead_1.buildLetterHtml)({
                brand,
                title: `Access to ${grant.projectName}`,
                recipient: grant.name,
                date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                body: `<p>You've been given access to ${grant.projectName}.</p><p><a href="${grant.link}">Open your project</a> — this link works for about ${days} day${days === 1 ? '' : 's'}.</p>`,
            });
            await this.google.sendMail({
                to: grant.email,
                subject: `Your access to ${grant.projectName}`,
                html,
            });
        }
        catch (err) {
            return { ...grant, emailSent: false, emailError: err.message };
        }
        return { ...grant, emailSent: true };
    }
    revoke(id) {
        return this.service.revoke(Number(id));
    }
    promote(id) {
        return this.service.promote(Number(id));
    }
    resolve(token) {
        return this.service.resolveToken(token);
    }
};
exports.GuestAccessController = GuestAccessController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GuestAccessController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], GuestAccessController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/revoke'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GuestAccessController.prototype, "revoke", null);
__decorate([
    (0, common_1.Post)(':id/promote'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GuestAccessController.prototype, "promote", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('resolve'),
    __param(0, (0, common_1.Body)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GuestAccessController.prototype, "resolve", null);
exports.GuestAccessController = GuestAccessController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('guest-access'),
    __metadata("design:paramtypes", [guest_access_service_1.GuestAccessService,
        google_service_1.GoogleService,
        settings_service_1.SettingsService])
], GuestAccessController);
//# sourceMappingURL=guest-access.controller.js.map