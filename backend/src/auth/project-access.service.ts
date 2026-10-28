import { ForbiddenException, Global, Injectable, Module, Optional, UnauthorizedException } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonEntity, ProjectEntity, RoleEntity, UserEntity } from '../database/entities';
import { effectivePermissions, extentOf } from '../users/access-levels';
import type { SessionClaims } from './crypto.util';
import { PORTAL_ROLE } from './guards/roles.decorator';

/**
 * Which projects a signed-in account may read.
 *
 * Staff see every project. Clients, consultants and guests see only projects
 * they are linked to in the People directory (their email on a person whose
 * project list names the project) -- the same link Guest Access writes and the
 * client dashboards read. Portal accounts reach projects only through the
 * portal's own routes, never through these.
 */
@Injectable()
export class ProjectAccessService {
  constructor(
    @InjectRepository(PersonEntity) private readonly people: Repository<PersonEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @Optional() @InjectRepository(RoleEntity) private readonly roles?: Repository<RoleEntity>,
    @Optional() @InjectRepository(UserEntity) private readonly users?: Repository<UserEntity>,
  ) {}

  // Role / user lookups are asked for on most project reads: kept a few seconds.
  private cache = new Map<string, { at: number; assigned: boolean }>();
  /** Staff whose access says "Assigned projects" (role overall, or their own change): only their projects. */
  private async assignedOnly(claims: SessionClaims): Promise<boolean> {
    if (claims.roleKey === 'admin' || !this.roles || !this.users) return false;
    const key = claims.sub + '|' + claims.roleKey;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 15_000) return hit.assigned;
    const [role, user] = await Promise.all([this.roles.findOneBy({ key: claims.roleKey }), this.users.findOneBy({ id: claims.sub })]);
    const assigned = extentOf(effectivePermissions(role?.permissions as any, user?.permissionOverrides as any)) === 'assigned';
    this.cache.set(key, { at: Date.now(), assigned });
    return assigned;
  }

  /** True for staff (and administrators, whatever their tier). */
  isStaff(claims: SessionClaims | null) {
    return !!claims && (claims.roleKey === 'admin' || (claims.tier === 'internal' && claims.roleKey !== PORTAL_ROLE));
  }

  /** 'all' for staff; otherwise the ids of the projects this account is linked to. */
  async allowedIds(claims: SessionClaims | null): Promise<'all' | Set<number>> {
    if (!claims) throw new UnauthorizedException('Sign in first.');
    if (this.isStaff(claims) && !(await this.assignedOnly(claims))) return 'all';
    if (claims.roleKey === PORTAL_ROLE) return new Set();
    // Their People entries: the one their login was given from (People.userId), and any with the same email.
    const email = String(claims.email || '').trim().toLowerCase();
    const linked = (await this.people.find())
      .filter((p) => (p.userId && p.userId === claims.sub) || (!!email && String(p.email || '').trim().toLowerCase() === email))
      .flatMap((p) => p.projects || []);
    if (!linked.length) return new Set();
    const names = new Set(linked);
    return new Set((await this.projects.find()).filter((p) => names.has(p.name)).map((p) => p.id));
  }

  async canSee(claims: SessionClaims | null, projectId: number | null | undefined) {
    const allowed = await this.allowedIds(claims);
    return allowed === 'all' || (projectId != null && allowed.has(Number(projectId)));
  }

  /** Throws unless the account may read this project. */
  async assert(claims: SessionClaims | null, projectId: number | null | undefined) {
    if (!(await this.canSee(claims, projectId))) throw new ForbiddenException('You don’t have access to this project.');
  }

  /** Throws unless the caller is staff -- for anything that changes shared records. */
  assertStaff(claims: SessionClaims | null) {
    if (!this.isStaff(claims)) throw new ForbiddenException('Only the project team can change this.');
  }

  /** A list narrowed to the projects the account may read. */
  async filter<T>(claims: SessionClaims | null, rows: T[], projectIdOf: (row: T) => number | null | undefined) {
    const allowed = await this.allowedIds(claims);
    if (allowed === 'all') return rows;
    return rows.filter((r) => { const id = projectIdOf(r); return id != null && allowed.has(Number(id)); });
  }
}

/** Available everywhere, so any controller can scope what it returns. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PersonEntity, ProjectEntity, RoleEntity, UserEntity])],
  providers: [ProjectAccessService],
  exports: [ProjectAccessService],
})
export class ProjectAccessModule {}
