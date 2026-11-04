import { ROLE_MERGE } from './role-merge';
import { BadRequestException, Injectable, OnApplicationBootstrap, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettingEntity, RoleEntity, UserEntity } from '../database/entities';
import { DEFAULT_ROLES, SITE_SUPER_PERMISSIONS } from '../seed-data/users';

/** Marks the one-time trim of the Site Superintendent role (v3: 2026-09-28, projects and File Room dropped). */
const TIERS = ['internal', 'client', 'consultant'];

export const SITE_SUPER_TRIM_KEY = 'roles.siteSuperTrimmed.v3';

@Injectable()
export class RolesService implements OnApplicationBootstrap {
  private readonly log = new Logger('RolesService');

  constructor(
    @InjectRepository(RoleEntity) private readonly repo: Repository<RoleEntity>,
    @InjectRepository(AppSettingEntity) private readonly settings: Repository<AppSettingEntity>,
    @Optional() @InjectRepository(UserEntity) private readonly users?: Repository<UserEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      // Top up rather than seed-once: a role added after the table was first
      // filled would otherwise never appear on an existing install. Only
      // missing keys are inserted, so edited permissions are left alone.
      const existing = new Set((await this.repo.find()).map((r) => r.key));
      // An old default whose access-matrix role is there isn't brought back (Nov 3 sync: no duplicates).
      const missing = DEFAULT_ROLES.filter((r) => !existing.has(r.key) && !(ROLE_MERGE[r.key] && existing.has(ROLE_MERGE[r.key])));
      if (missing.length) {
        await this.repo.save(missing as unknown as RoleEntity[]);
        this.log.log(`Seeded ${missing.length} role(s)`);
      }
      await this.trimSiteSuper();
    } catch (err) {
      this.log.error('Roles seed failed: ' + (err as Error).message);
    }
  }

  /**
   * Once: the Site Superintendent role sees only its own dashboard and tasks. After that it's edited like any other role.
   */
  async trimSiteSuper() {
    if (await this.settings.findOneBy({ key: SITE_SUPER_TRIM_KEY })) return;
    const role = await this.repo.findOneBy({ key: 'site_super' });
    if (role) {
      role.permissions = SITE_SUPER_PERMISSIONS;
      await this.repo.save(role);
      this.log.log('Site Superintendent role trimmed to dashboard and tasks');
    }
    await this.settings.save({ key: SITE_SUPER_TRIM_KEY, value: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  findAll() {
    return this.repo.find({ order: { order: 'ASC' } });
  }

  /**
   * The duplicate roles and who is on them (Nov 3 sync): each old default
   * whose access-matrix role exists, the people who would move, and whether
   * the old role then goes. Read-only.
   */
  async duplicatePlan() {
    const [roles, users] = await Promise.all([this.repo.find(), this.users ? this.users.find() : Promise.resolve([] as UserEntity[])]);
    const byKey = new Map(roles.map((r) => [r.key, r]));
    return Object.entries(ROLE_MERGE)
      .filter(([from, to]) => byKey.has(from) && byKey.has(to))
      .map(([from, to]) => ({
        from: { key: from, name: byKey.get(from)!.name },
        to: { key: to, name: byKey.get(to)!.name },
        users: users.filter((u) => u.roleKey === from).map((u) => ({ id: u.id, name: u.name, email: u.email })),
      }));
  }

  /** Apply the plan: move each person to the matrix role, then remove the empty old role. Admin only, after review. */
  async mergeDuplicates(confirm: boolean) {
    const plan = await this.duplicatePlan();
    if (!confirm) return { applied: false, plan };
    let moved = 0;
    for (const p of plan) {
      for (const u of p.users) { await this.users!.update({ id: u.id } as any, { roleKey: p.to.key } as any); moved++; }
      const left = this.users ? await this.users.count({ where: { roleKey: p.from.key } as any }) : 0;
      if (!left) await this.repo.delete({ key: p.from.key } as any);
    }
    this.log.log(`Merged ${plan.length} duplicate role(s); moved ${moved} user(s)`);
    return { applied: true, moved, removed: plan.map((p) => p.from.key) };
  }

  create(dto: any) {
    const key = dto.key || 'role_' + Date.now();
    const role = { order: 999, isSystem: false, description: '', permissions: {}, ...dto, key };
    return this.repo.save(this.repo.create(role as Partial<RoleEntity>));
  }

  async update(key: string, dto: any) {
    let role = await this.repo.findOneBy({ key });
    if (role && dto?.tier !== undefined && dto.tier !== role.tier) await this.checkTypeChange(role, dto.tier);
    if (!role) role = this.repo.create({ key } as Partial<RoleEntity>);
    Object.assign(role, dto, { key });
    return this.repo.save(role);
  }

  /**
   * A role's type (Internal / Client / Third Party) decides which people it
   * can be given to. It can change while nobody has the role; built-in roles keep theirs.
   */
  private async checkTypeChange(role: RoleEntity, tier: unknown) {
    if (!TIERS.includes(tier as string)) throw new BadRequestException('Pick Internal, Client or Third Party.');
    if (role.isSystem) throw new BadRequestException(`${role.name} is a built-in role; its type can't change.`);
    const n = this.users ? await this.users.count({ where: { roleKey: role.key } }) : 0;
    if (n) throw new BadRequestException(`${n} ${n === 1 ? 'person has' : 'people have'} the ${role.name} role. Give them another role first, then change its type.`);
  }

  async remove(key: string) {
    const role = await this.repo.findOneBy({ key });
    if (role?.isSystem) throw new NotFoundException(`Role ${key} is protected`);
    if (role) await this.repo.remove(role);
    return { key, deleted: true };
  }
}
