import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'auth:isPublic';

/**
 * Marks a route as reachable without a session.
 *
 * Only for the endpoints that necessarily run before anyone can have a token —
 * signing in, redeeming an invite, resetting a password, and the Google OAuth
 * round trip. Anything else needs a real reason.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
