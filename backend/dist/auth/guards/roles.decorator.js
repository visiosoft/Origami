"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tiers = exports.Roles = exports.TIERS_KEY = exports.ROLES_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.ROLES_KEY = 'auth:roles';
exports.TIERS_KEY = 'auth:tiers';
const Roles = (...roleKeys) => (0, common_1.SetMetadata)(exports.ROLES_KEY, roleKeys);
exports.Roles = Roles;
const Tiers = (...tiers) => (0, common_1.SetMetadata)(exports.TIERS_KEY, tiers);
exports.Tiers = Tiers;
//# sourceMappingURL=roles.decorator.js.map