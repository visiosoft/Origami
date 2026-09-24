import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from '../database/entities';
import { AuthService } from '../auth/auth.service';

export interface Actor { name: string; id?: string; roleKey?: string }

/**
 * Checks an action against the caller's role, using the same per-module
 * view/manage permissions the Roles admin screen edits -- no separate
 * authorization system. Used where the approver matters (finance steps,
 * payroll sign-off), on top of the tier guard every manpower route has.
 */
@Injectable()
export class ManpowerAccess {
  constructor(
    @InjectRepository(RoleEntity) private readonly roles: Repository<RoleEntity>,
    private readonly auth: AuthService,
  ) {}

  async actor(bearer: string | undefined): Promise<Actor> {
    const claims = await this.auth.verify(bearer);
    return claims ? { id: claims.sub, name: claims.name, roleKey: claims.roleKey } : { name: 'Unknown' };
  }

  async can(actor: Actor, moduleKey: string, action: 'view' | 'manage' = 'manage'): Promise<boolean> {
    if (!actor.roleKey) return false;
    if (actor.roleKey === 'admin') return true;
    const role = await this.roles.findOneBy({ key: actor.roleKey });
    return !!role?.permissions?.[moduleKey]?.[action];
  }

  /** The caller's whole permission map ('all' for administrators), for checks that need several keys at once. */
  async permissionsOf(actor: Actor): Promise<Record<string, { view?: boolean; manage?: boolean }> | 'all' | null> {
    if (!actor.roleKey) return null;
    if (actor.roleKey === 'admin') return 'all';
    const role = await this.roles.findOneBy({ key: actor.roleKey });
    return (role?.permissions as any) || null;
  }

  async require(actor: Actor, moduleKey: string, what: string) {
    if (!(await this.can(actor, moduleKey))) {
      throw new ForbiddenException(`Your role doesn't allow you to ${what}.`);
    }
  }
}

/** HR / workforce actions. */
export const HR_MODULE = 'manpower_con';
/** Money actions: payroll sign-off, paying out, finance approval of advances. */
export const FINANCE_MODULE = 'fin_resources';
