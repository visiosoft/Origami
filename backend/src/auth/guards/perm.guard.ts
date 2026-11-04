import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectAccessService } from '../project-access.service';
import type { AuthedRequest } from './session.guard';

export const PERM_KEY = 'auth:perm';

/**
 * The module(s) a controller or route belongs to (Oct 30 sync): a staff
 * member needs view on at least one of them -- the same settings that decide
 * their menu. Before, the server only checked the account's tier, so a
 * restricted role could read anything the menu hid. Administrators pass;
 * client and consultant accounts are scoped by project instead.
 * `@Perm()` with no modules (on a route) lifts its controller's check.
 */
export const Perm = (...modules: string[]) => SetMetadata(PERM_KEY, modules);

export const MANAGE_KEY = 'auth:manage-writes';
/**
 * Changes (POST / PUT / PATCH / DELETE) need *manage* on one of these modules
 * (Nov 3 sync: resource management is added to and removed from by Astrid and
 * accounting only; reading stays as it is). `@ManageWrites()` with no modules
 * on a route lifts its controller's rule -- e.g. a superintendent filing their
 * own daily report.
 */
export const ManageWrites = (...modules: string[]) => SetMetadata(MANAGE_KEY, modules);
const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class PermGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly access: ProjectAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest & { method?: string }>();
    const claims = req.claims;
    const manage = this.reflector.getAllAndOverride<string[]>(MANAGE_KEY, [context.getHandler(), context.getClass()]);
    if (claims && manage?.length && WRITES.has(String(req.method || '').toUpperCase()) && !(await this.access.canManage(claims, ...manage))) {
      throw new ForbiddenException('Your role can look at this but not change it. Ask an administrator if you need to.');
    }
    const modules = this.reflector.getAllAndOverride<string[]>(PERM_KEY, [context.getHandler(), context.getClass()]);
    if (!modules?.length) return true;
    if (!claims) return true; // public, or SessionGuard's audit mode
    if (await this.access.canView(claims, ...modules)) return true;
    throw new ForbiddenException('Your role doesn’t include this. Ask an administrator to change your access.');
  }
}
