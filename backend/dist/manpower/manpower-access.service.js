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
exports.FINANCE_MODULE = exports.HR_MODULE = exports.ManpowerAccess = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const auth_service_1 = require("../auth/auth.service");
let ManpowerAccess = class ManpowerAccess {
    constructor(roles, auth) {
        this.roles = roles;
        this.auth = auth;
    }
    async actor(bearer) {
        const claims = await this.auth.verify(bearer);
        return claims ? { id: claims.sub, name: claims.name, roleKey: claims.roleKey } : { name: 'Unknown' };
    }
    async can(actor, moduleKey, action = 'manage') {
        if (!actor.roleKey)
            return false;
        if (actor.roleKey === 'admin')
            return true;
        const role = await this.roles.findOneBy({ key: actor.roleKey });
        return !!role?.permissions?.[moduleKey]?.[action];
    }
    async require(actor, moduleKey, what) {
        if (!(await this.can(actor, moduleKey))) {
            throw new common_1.ForbiddenException(`Your role doesn't allow you to ${what}.`);
        }
    }
};
exports.ManpowerAccess = ManpowerAccess;
exports.ManpowerAccess = ManpowerAccess = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.RoleEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        auth_service_1.AuthService])
], ManpowerAccess);
exports.HR_MODULE = 'manpower_con';
exports.FINANCE_MODULE = 'fin_resources';
//# sourceMappingURL=manpower-access.service.js.map