"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnySignedIn = exports.PortalRoute = exports.ANY_SIGNED_IN_KEY = exports.PORTAL_KEY = exports.PORTAL_ROLE = exports.Tiers = exports.Roles = exports.TIERS_KEY = exports.ROLES_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.ROLES_KEY = 'auth:roles';
exports.TIERS_KEY = 'auth:tiers';
const Roles = (...roleKeys) => (0, common_1.SetMetadata)(exports.ROLES_KEY, roleKeys);
exports.Roles = Roles;
const Tiers = (...tiers) => (0, common_1.SetMetadata)(exports.TIERS_KEY, tiers);
exports.Tiers = Tiers;
exports.PORTAL_ROLE = 'vendor_portal';
exports.PORTAL_KEY = 'auth:portal';
exports.ANY_SIGNED_IN_KEY = 'auth:anySignedIn';
const PortalRoute = () => (0, common_1.SetMetadata)(exports.PORTAL_KEY, true);
exports.PortalRoute = PortalRoute;
const AnySignedIn = () => (0, common_1.SetMetadata)(exports.ANY_SIGNED_IN_KEY, true);
exports.AnySignedIn = AnySignedIn;
//# sourceMappingURL=roles.decorator.js.map