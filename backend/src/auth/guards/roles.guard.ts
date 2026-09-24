import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ANY_SIGNED_IN_KEY, PORTAL_KEY, PORTAL_ROLE, ROLES_KEY, TIERS_KEY } from './roles.decorator';
import { IS_PUBLIC } from './public.decorator';
import type { AuthedRequest } from './session.guard';

/**
 * Applies `@Roles()` and `@Tiers()` once SessionGuard has resolved the caller.
 *
 * Admins bypass tier checks: an administrator whose account happens to sit in a
 * non-internal tier should not lock themselves out of the platform, which is
 * the same exemption `isRestrictedViewer()` already makes for task visibility.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly log = new Logger('Auth');
  private readonly audit = process.env.AUTH_AUDIT === '1';

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, targets);
    const tiers = this.reflector.getAllAndOverride<string[]>(TIERS_KEY, targets);
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const claims = req.claims;

    // Portal accounts are allow-listed, not deny-listed: only portal routes and the few every account needs.
    if (claims?.roleKey === PORTAL_ROLE) {
      const allowed = this.reflector.getAllAndOverride<boolean>(PORTAL_KEY, targets)
        || this.reflector.getAllAndOverride<boolean>(ANY_SIGNED_IN_KEY, targets)
        || this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);
      if (!allowed) return this.deny(req, 'portal account outside the portal');
      if (this.reflector.getAllAndOverride<boolean>(PORTAL_KEY, targets)) return true;
    }
    if (!roles?.length && !tiers?.length) return true;
    // No claims means SessionGuard let this through in audit mode; nothing to check.
    if (!claims) return true;

    const isAdmin = claims.roleKey === 'admin';
    if (roles?.length && !roles.includes(claims.roleKey)) {
      return this.deny(req, `role ${claims.roleKey} not in [${roles.join(', ')}]`);
    }
    if (tiers?.length && !isAdmin && !tiers.includes(claims.tier)) {
      return this.deny(req, `tier ${claims.tier} not in [${tiers.join(', ')}]`);
    }
    return true;
  }

  private deny(req: AuthedRequest, why: string): boolean {
    if (this.audit) {
      this.log.warn(`AUDIT would reject ${req.method} ${req.originalUrl} — ${why}`);
      return true;
    }
    throw new ForbiddenException('Your account does not have access to this.');
  }
}
