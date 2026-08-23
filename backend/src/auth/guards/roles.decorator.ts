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
