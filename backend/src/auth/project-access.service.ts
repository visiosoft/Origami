import { personProjectIds } from '../people/person-projects';
import { ForbiddenException, Global, Injectable, Module, Optional, UnauthorizedException } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonEntity, ProjectEntity, RoleEntity, UserEntity } from '../database/entities';
import { effectivePermissions, extentOf, type PermMap } from '../users/access-levels';
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
/** Roles that work on site: limited to their own projects unless set otherwise. */
const FIELD_ROLE = /super|foreman|labou?r|site_/i;
const OVERALL = '__overall';

@Injectable()
export class ProjectAccessService {
  constructor(
    @InjectRepository(PersonEntity) private readonly people: Repository<PersonEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @Optional() @InjectRepository(RoleEntity) private readonly roles?: Repository<RoleEntity>,
    @Optional() @InjectRepository(UserEntity) private readonly users?: Repository<UserEntity>,
  ) {}

  // Role / user lookups are asked for on most reads: kept a few seconds.
  private cache = new Map<string, { at: number; perms: PermMap }>();
  /** The caller's role permissions with their own overrides on top (what the menu shows them). */
  async permissions(claims: SessionClaims): Promise<PermMap> {
    if (!this.roles || !this.users) return {};
    const key = claims.sub + '|' + claims.roleKey;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 15_000) return hit.perms;
    const [role, user] = await Promise.all([this.roles.findOneBy({ key: claims.roleKey }), this.users.findOneBy({ id: claims.sub })]);
    const perms = effectivePermissions(role?.permissions as any, user?.permissionOverrides as any);
    this.cache.set(key, { at: Date.now(), perms });
    return perms;
  }
  /**
   * May the caller view any of these modules (Oct 30 sync: the server now
   * applies the role's settings, not only the menu)? Administrators always;
   * clients, consultants and guests are scoped elsewhere, by project.
   */
  async canView(claims: SessionClaims | null, ...modules: string[]): Promise<boolean> {
    if (!claims) return false;
    if (claims.roleKey === 'admin' || !this.isStaff(claims)) return true;
    const perms = await this.permissions(claims);
    return modules.some((m) => !!perms[m]?.view);
  }
  /** May the caller change things in any of these modules (manage)? Administrators always; outside accounts never. */
  async canManage(claims: SessionClaims | null, ...modules: string[]): Promise<boolean> {
    if (!claims) return false;
    if (claims.roleKey === 'admin') return true;
    if (!this.isStaff(claims)) return false;
    const perms = await this.permissions(claims);
    return modules.some((m) => !!perms[m]?.manage);
  }
  /** Throws unless the caller may view one of these modules. */
  async assertView(claims: SessionClaims | null, what: string, ...modules: string[]) {
    if (!(await this.canView(claims, ...modules))) throw new ForbiddenException(`Your role doesn’t include ${what}.`);
  }
  /** Staff whose access says "Assigned projects" (role overall, or their own change): only their projects. */
  private async assignedOnly(claims: SessionClaims): Promise<boolean> {
    if (claims.roleKey === 'admin' || !this.roles || !this.users) return false;
    const perms = await this.permissions(claims);
    // Field roles (superintendents, foremen, labour) with no overall setting see only their projects (Nov 3 sync).
    if (!perms?.[OVERALL] && FIELD_ROLE.test(String(claims.roleKey || ''))) return true;
    return extentOf(perms) === 'assigned';
  }

  /**
   * 'all', or the leads the caller may see (Nov 3 sync: "Assigned projects"
   * holds for CRM too): leads that became one of their projects, and leads
   * they're the assignee of or hold a role on.
   */
  async allowedLeadIds(claims: SessionClaims | null, deals: { id: string; assignee?: string | null; roles?: Record<string, string> | null }[] = []): Promise<'all' | Set<string>> {
    const ids = await this.allowedIds(claims);
    if (ids === 'all') return 'all';
    const out = new Set((await this.projects.find()).filter((p) => ids.has(p.id) && (p as any).leadId).map((p) => String((p as any).leadId)));
    const me = (v: unknown) => !!v && (v === claims!.sub || String(v).trim().toLowerCase() === String(claims!.name || '').trim().toLowerCase());
    for (const d of deals) if (me(d.assignee) || Object.values(d.roles || {}).some(me)) out.add(String(d.id));
    return out;
  }

  /** Every project's id and name (kept a few seconds): matching people's projects. */
  private refs: { at: number; rows: { id: number; name: string }[] } | null = null;
  async projectRefs(): Promise<{ id: number; name: string }[]> {
    if (this.refs && Date.now() - this.refs.at < 15_000) return this.refs.rows;
    const rows = (await this.projects.find({ select: { id: true, name: true } })).map((p) => ({ id: p.id, name: p.name }));
    this.refs = { at: Date.now(), rows };
    return rows;
  }

  /** 'all', or the names of the projects the caller may read -- for records kept by project name (the Special Actions Log, people). */
  async allowedNames(claims: SessionClaims | null): Promise<'all' | Set<string>> {
    const ids = await this.allowedIds(claims);
    if (ids === 'all') return 'all';
    return new Set((await this.projects.find()).filter((p) => ids.has(p.id)).map((p) => p.name));
  }

  /** True for staff (and administrators, whatever their tier). */
  /**
   * Client phone numbers, emails and addresses (Nov 10, PEOPLE ACCESS sheet):
   * not below internal level 2 -- superintendents, foremen and labour work
   * through the office, not with the client directly.
   */
  seesClientContacts(claims: SessionClaims | null): boolean {
    if (!claims) return false;
    if (claims.roleKey === 'admin') return true;
    return this.isStaff(claims) && !FIELD_ROLE.test(String(claims.roleKey || ''));
  }

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
    const mine = (await this.people.find())
      .filter((p) => (p.userId && p.userId === claims.sub) || (!!email && String(p.email || '').trim().toLowerCase() === email));
    if (!mine.length) return new Set();
    // By project id (Nov 13); people not moved to ids yet are matched by name.
    const projects = await this.projectRefs();
    return new Set(mine.flatMap((p) => personProjectIds(p, projects)));
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
