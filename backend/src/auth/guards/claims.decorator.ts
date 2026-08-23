import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SessionClaims } from '../crypto.util';
import type { AuthedRequest } from './session.guard';

/**
 * The signed-in caller, as resolved by SessionGuard.
 *
 * Null only on `@Public()` routes and while audit mode is letting anonymous
 * requests through, so guarded handlers can treat it as present.
 */
export const Claims = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionClaims | null =>
    ctx.switchToHttp().getRequest<AuthedRequest>().claims ?? null,
);
