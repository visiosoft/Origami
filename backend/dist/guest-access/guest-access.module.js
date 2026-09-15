"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuestAccessModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const entities_1 = require("../database/entities");
const guest_access_service_1 = require("./guest-access.service");
const guest_access_controller_1 = require("./guest-access.controller");
const auth_module_1 = require("../auth/auth.module");
const settings_module_1 = require("../settings/settings.module");
const people_module_1 = require("../people/people.module");
let GuestAccessModule = class GuestAccessModule {
};
exports.GuestAccessModule = GuestAccessModule;
exports.GuestAccessModule = GuestAccessModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([entities_1.GuestAccessEntity, entities_1.UserEntity, entities_1.ProjectEntity]), auth_module_1.AuthModule, settings_module_1.SettingsModule, people_module_1.PeopleModule],
        controllers: [guest_access_controller_1.GuestAccessController],
        providers: [guest_access_service_1.GuestAccessService],
        exports: [guest_access_service_1.GuestAccessService],
    })
], GuestAccessModule);
//# sourceMappingURL=guest-access.module.js.map