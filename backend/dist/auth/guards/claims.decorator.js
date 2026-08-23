"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Claims = void 0;
const common_1 = require("@nestjs/common");
exports.Claims = (0, common_1.createParamDecorator)((_data, ctx) => ctx.switchToHttp().getRequest().claims ?? null);
//# sourceMappingURL=claims.decorator.js.map