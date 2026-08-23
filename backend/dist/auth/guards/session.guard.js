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
exports.SessionGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const auth_service_1 = require("../auth.service");
const public_decorator_1 = require("./public.decorator");
const cookie_util_1 = require("./cookie.util");
let SessionGuard = class SessionGuard {
    constructor(reflector, auth) {
        this.reflector = reflector;
        this.auth = auth;
        this.log = new common_1.Logger('Auth');
        this.audit = process.env.AUTH_AUDIT === '1';
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic)
            return true;
        const req = context.switchToHttp().getRequest();
        const claims = await this.resolve(req);
        if (claims) {
            req.claims = claims;
            return true;
        }
        if (this.audit) {
            this.log.warn(`AUDIT would reject unauthenticated ${req.method} ${req.originalUrl}`);
            return true;
        }
        throw new common_1.UnauthorizedException('Sign in to continue.');
    }
    async resolve(req) {
        const header = req.headers.authorization;
        if (header)
            return this.auth.verify(header);
        if (req.method === 'GET' || req.method === 'HEAD') {
            const cookie = (0, cookie_util_1.readCookie)(req.headers.cookie, cookie_util_1.SESSION_COOKIE);
            if (cookie)
                return this.auth.verify(cookie);
        }
        return null;
    }
};
exports.SessionGuard = SessionGuard;
exports.SessionGuard = SessionGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        auth_service_1.AuthService])
], SessionGuard);
//# sourceMappingURL=session.guard.js.map