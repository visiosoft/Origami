import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, TIERS_KEY } from './roles.decorator';
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
    if (!roles?.length && !tiers?.length) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const claims = req.claims;
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
