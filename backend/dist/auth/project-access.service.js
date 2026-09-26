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
exports.ProjectAccessModule = exports.ProjectAccessService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const roles_decorator_1 = require("./guards/roles.decorator");
let ProjectAccessService = class ProjectAccessService {
    constructor(people, projects) {
        this.people = people;
        this.projects = projects;
    }
    isStaff(claims) {
        return !!claims && (claims.roleKey === 'admin' || (claims.tier === 'internal' && claims.roleKey !== roles_decorator_1.PORTAL_ROLE));
    }
    async allowedIds(claims) {
        if (!claims)
            throw new common_1.UnauthorizedException('Sign in first.');
        if (this.isStaff(claims))
            return 'all';
        if (claims.roleKey === roles_decorator_1.PORTAL_ROLE)
            return new Set();
        const email = String(claims.email || '').trim().toLowerCase();
        const linked = (await this.people.find())
            .filter((p) => (p.userId && p.userId === claims.sub) || (!!email && String(p.email || '').trim().toLowerCase() === email))
            .flatMap((p) => p.projects || []);
        if (!linked.length)
            return new Set();
        const names = new Set(linked);
        return new Set((await this.projects.find()).filter((p) => names.has(p.name)).map((p) => p.id));
    }
    async canSee(claims, projectId) {
        const allowed = await this.allowedIds(claims);
        return allowed === 'all' || (projectId != null && allowed.has(Number(projectId)));
    }
    async assert(claims, projectId) {
        if (!(await this.canSee(claims, projectId)))
            throw new common_1.ForbiddenException('You don’t have access to this project.');
    }
    assertStaff(claims) {
        if (!this.isStaff(claims))
            throw new common_1.ForbiddenException('Only the project team can change this.');
    }
    async filter(claims, rows, projectIdOf) {
        const allowed = await this.allowedIds(claims);
        if (allowed === 'all')
            return rows;
        return rows.filter((r) => { const id = projectIdOf(r); return id != null && allowed.has(Number(id)); });
    }
};
exports.ProjectAccessService = ProjectAccessService;
exports.ProjectAccessService = ProjectAccessService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.PersonEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ProjectAccessService);
let ProjectAccessModule = class ProjectAccessModule {
};
exports.ProjectAccessModule = ProjectAccessModule;
exports.ProjectAccessModule = ProjectAccessModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([entities_1.PersonEntity, entities_1.ProjectEntity])],
        providers: [ProjectAccessService],
        exports: [ProjectAccessService],
    })
], ProjectAccessModule);
//# sourceMappingURL=project-access.service.js.map