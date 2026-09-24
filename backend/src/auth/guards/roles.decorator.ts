import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'auth:roles';
export const TIERS_KEY = 'auth:tiers';

/**
 * Restrict a controller or route to specific role keys, e.g. `@Roles('admin')`.
 * Used for the endpoints that administer the platform itself — users, roles,
 * settings and the Google connection.
 */
export const Roles = (...roleKeys: string[]) => SetMetadata(ROLES_KEY, roleKeys);

/**
 * Restrict to specific account tiers, e.g. `@Tiers('internal')`.
 *
 * This is what keeps clients and consultants out of the internal CRM surfaces.
 * It is a blunt instrument by design: until projects carry a membership list
 * there is nothing to filter records by, so the whole controller is closed
 * rather than half-opened.
 */
export const Tiers = (...tiers: string[]) => SetMetadata(TIERS_KEY, tiers);

/**
 * The subcontractor portal role. Unlike every other role it is locked down by
 * default: an account holding it reaches only routes marked `@PortalRoute()`
 * or `@AnySignedIn()` (and public ones), whatever else a controller allows --
 * so a trade partner's login can never wander into the internal app.
 */
export const PORTAL_ROLE = 'vendor_portal';
export const PORTAL_KEY = 'auth:portal';
export const ANY_SIGNED_IN_KEY = 'auth:anySignedIn';
/** A route of the subcontractor portal. */
export const PortalRoute = () => SetMetadata(PORTAL_KEY, true);
/** A route every signed-in account needs, portal included (who am I, and the like). */
export const AnySignedIn = () => SetMetadata(ANY_SIGNED_IN_KEY, true);
