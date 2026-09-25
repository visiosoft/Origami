"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RfisModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const entities_1 = require("../database/entities");
const auth_module_1 = require("../auth/auth.module");
const google_module_1 = require("../google/google.module");
const settings_module_1 = require("../settings/settings.module");
const manpower_access_service_1 = require("../manpower/manpower-access.service");
const rfis_service_1 = require("./rfis.service");
const rfis_controller_1 = require("./rfis.controller");
let RfisModule = class RfisModule {
};
exports.RfisModule = RfisModule;
exports.RfisModule = RfisModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([entities_1.RfiEntity, entities_1.ProjectEntity, entities_1.UserEntity, entities_1.RoleEntity]), auth_module_1.AuthModule, google_module_1.GoogleModule, settings_module_1.SettingsModule],
        controllers: [rfis_controller_1.RfisController],
        providers: [rfis_service_1.RfisService, manpower_access_service_1.ManpowerAccess],
        exports: [rfis_service_1.RfisService],
    })
], RfisModule);
//# sourceMappingURL=rfis.module.js.map