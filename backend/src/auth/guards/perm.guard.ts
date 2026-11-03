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

@Injectable()
export class PermGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly access: ProjectAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const modules = this.reflector.getAllAndOverride<string[]>(PERM_KEY, [context.getHandler(), context.getClass()]);
    if (!modules?.length) return true;
    const claims = context.switchToHttp().getRequest<AuthedRequest>().claims;
    if (!claims) return true; // public, or SessionGuard's audit mode
    if (await this.access.canView(claims, ...modules)) return true;
    throw new ForbiddenException('Your role doesn’t include this. Ask an administrator to change your access.');
  }
}
