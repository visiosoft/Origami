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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusController = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const public_decorator_1 = require("../auth/guards/public.decorator");
const settings_service_1 = require("./settings.service");
function servedBuild() {
    const index = (0, path_1.join)(__dirname, '..', '..', 'client', 'index.html');
    if (!(0, fs_1.existsSync)(index))
        return '';
    const m = (0, fs_1.readFileSync)(index, 'utf8').match(/assets\/(index-[\w-]+\.js)/);
    return m ? m[1] : '';
}
const BUILD = servedBuild();
let StatusController = class StatusController {
    constructor(settings) {
        this.settings = settings;
    }
    async status() {
        const s = await this.settings.getMany(['app.noticeActive', 'app.notice']);
        const on = s['app.noticeActive'] === 'true' && !!(s['app.notice'] || '').trim();
        return { build: BUILD, notice: on ? s['app.notice'].trim() : null };
    }
};
exports.StatusController = StatusController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatusController.prototype, "status", null);
exports.StatusController = StatusController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Controller)('status'),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], StatusController);
//# sourceMappingURL=status.controller.js.map