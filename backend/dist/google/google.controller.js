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
exports.GoogleController = void 0;
const common_1 = require("@nestjs/common");
const google_service_1 = require("./google.service");
const settings_service_1 = require("../settings/settings.service");
const auth_service_1 = require("../auth/auth.service");
const crypto_util_1 = require("../auth/crypto.util");
let GoogleController = class GoogleController {
    constructor(google, settings, auth) {
        this.google = google;
        this.settings = settings;
        this.auth = auth;
    }
    status() {
        return this.google.status();
    }
    async connect(res) {
        const secret = await this.settings.jwtSecret();
        const url = await this.google.consentUrl('connect', (0, crypto_util_1.signState)({ mode: 'connect' }, secret));
        return res.redirect(url);
    }
    async login(res) {
        const secret = await this.settings.jwtSecret();
        const url = await this.google.consentUrl('login', (0, crypto_util_1.signState)({ mode: 'login' }, secret));
        return res.redirect(url);
    }
    async callback(code, state, error, res) {
        const base = (await this.settings.baseUrl()) || '';
        const secret = await this.settings.jwtSecret();
        const parsed = (0, crypto_util_1.readState)(state, secret);
        const mode = parsed?.mode === 'connect' ? 'connect' : 'login';
        const fail = (msg) => res.redirect(mode === 'connect'
            ? `${base}/settings?tab=google&error=${encodeURIComponent(msg)}`
            : `${base}/login?error=${encodeURIComponent(msg)}`);
        if (error)
            return fail(error === 'access_denied' ? 'Google sign-in was cancelled.' : error);
        if (!parsed)
            return fail('The sign-in link expired. Please try again.');
        if (!code)
            return fail('Google did not return an authorization code.');
        try {
            const tokens = await this.google.exchangeCode(code);
            const profile = await this.google.profile(tokens.access_token);
            if (mode === 'connect') {
                await this.google.saveConnection(tokens.refresh_token, profile);
                return res.redirect(`${base}/settings?tab=google&connected=${encodeURIComponent(profile.email)}`);
            }
            const session = await this.auth.loginWithGoogle(profile);
            return res.redirect(`${base}/login#token=${encodeURIComponent(session.token)}`);
        }
        catch (err) {
            return fail(err?.response?.message || err?.message || 'Google sign-in failed.');
        }
    }
    async disconnect() {
        await this.google.disconnect();
        return this.google.status();
    }
    async test(body) {
        const to = body?.to || (await this.settings.get('google.connectedEmail')) || '';
        if (!to)
            return { sent: false, error: 'No recipient. Connect a Google account first.' };
        await this.google.sendMail({
            to,
            subject: 'Origami test email',
            html: '<p>Your Origami workspace is connected to Gmail — outgoing mail is working.</p>',
        });
        return { sent: true, to };
    }
    send(body) {
        return this.google.sendMail(body);
    }
    files(q) {
        return this.google.listDriveFiles(q);
    }
};
exports.GoogleController = GoogleController;
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GoogleController.prototype, "status", null);
__decorate([
    (0, common_1.Get)('connect'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GoogleController.prototype, "connect", null);
__decorate([
    (0, common_1.Get)('login'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GoogleController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('callback'),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Query)('error')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], GoogleController.prototype, "callback", null);
__decorate([
    (0, common_1.Post)('disconnect'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], GoogleController.prototype, "disconnect", null);
__decorate([
    (0, common_1.Post)('test-email'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GoogleController.prototype, "test", null);
__decorate([
    (0, common_1.Post)('send'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GoogleController.prototype, "send", null);
__decorate([
    (0, common_1.Get)('drive/files'),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GoogleController.prototype, "files", null);
exports.GoogleController = GoogleController = __decorate([
    (0, common_1.Controller)('google'),
    __metadata("design:paramtypes", [google_service_1.GoogleService,
        settings_service_1.SettingsService,
        auth_service_1.AuthService])
], GoogleController);
//# sourceMappingURL=google.controller.js.map