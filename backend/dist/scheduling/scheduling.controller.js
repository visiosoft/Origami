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
exports.SchedulingController = void 0;
const common_1 = require("@nestjs/common");
const calendar_service_1 = require("../google/calendar.service");
const settings_service_1 = require("../settings/settings.service");
const auth_service_1 = require("../auth/auth.service");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
let SchedulingController = class SchedulingController {
    constructor(calendar, settings, auth) {
        this.calendar = calendar;
        this.settings = settings;
        this.auth = auth;
    }
    async calendars() {
        const raw = await this.settings.get('scheduling.calendars');
        if (!raw)
            return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((c) => c?.email) : [];
        }
        catch {
            return [];
        }
    }
    async setCalendars(body) {
        const clean = (Array.isArray(body) ? body : [])
            .filter((c) => c?.email?.trim())
            .map((c) => ({ name: String(c.name || '').trim(), email: String(c.email).trim() }));
        await this.settings.set('scheduling.calendars', JSON.stringify(clean));
        return clean;
    }
    async availability(from, to, emails) {
        if (!from || !to)
            return [];
        const list = emails
            ? emails.split(',').map((e) => e.trim()).filter(Boolean)
            : (await this.calendars()).map((c) => c.email);
        return this.calendar.freeBusy(list, from, to);
    }
    async createEvent(req, body) {
        const userId = req.claims?.sub;
        if (!userId)
            throw new common_1.BadRequestException('Sign in to continue.');
        const creds = await this.auth.myCalendarCredentials(userId);
        if (!creds)
            throw new common_1.BadRequestException('Connect your calendar first: Settings → My Calendar.');
        return this.calendar.scheduleMyEvent(userId, creds.refreshToken, body);
    }
};
exports.SchedulingController = SchedulingController;
__decorate([
    (0, common_1.Get)('calendars'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulingController.prototype, "calendars", null);
__decorate([
    (0, common_1.Post)('calendars'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], SchedulingController.prototype, "setCalendars", null);
__decorate([
    (0, common_1.Get)('availability'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('emails')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], SchedulingController.prototype, "availability", null);
__decorate([
    (0, common_1.Post)('events'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SchedulingController.prototype, "createEvent", null);
exports.SchedulingController = SchedulingController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('scheduling'),
    __metadata("design:paramtypes", [calendar_service_1.CalendarService,
        settings_service_1.SettingsService,
        auth_service_1.AuthService])
], SchedulingController);
//# sourceMappingURL=scheduling.controller.js.map