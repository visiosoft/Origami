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
exports.RemindersController = void 0;
const common_1 = require("@nestjs/common");
const public_decorator_1 = require("../auth/guards/public.decorator");
const reminders_service_1 = require("./reminders.service");
const settings_service_1 = require("../settings/settings.service");
let RemindersController = class RemindersController {
    constructor(reminders, settings) {
        this.reminders = reminders;
        this.settings = settings;
    }
    async run(token) {
        const expected = await this.settings.get('reminders.triggerToken');
        if (!expected || token !== expected)
            throw new common_1.ForbiddenException('Invalid reminder token.');
        return this.reminders.run();
    }
};
exports.RemindersController = RemindersController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('run'),
    __param(0, (0, common_1.Headers)('x-reminder-token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RemindersController.prototype, "run", null);
exports.RemindersController = RemindersController = __decorate([
    (0, common_1.Controller)('reminders'),
    __metadata("design:paramtypes", [reminders_service_1.RemindersService,
        settings_service_1.SettingsService])
], RemindersController);
//# sourceMappingURL=reminders.controller.js.map