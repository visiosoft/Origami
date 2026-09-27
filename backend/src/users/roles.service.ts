import { Injectable, OnApplicationBootstrap, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettingEntity, RoleEntity } from '../database/entities';
import { DEFAULT_ROLES, SITE_SUPER_PERMISSIONS } from '../seed-data/users';

/** Marks the one-time trim of the Site Superintendent role (2026-09-27). */
export const SITE_SUPER_TRIM_KEY = 'roles.siteSuperTrimmed';

@Injectable()
export class RolesService implements OnApplicationBootstrap {
  private readonly log = new Logger('RolesService');

  constructor(
    @InjectRepository(RoleEntity) private readonly repo: Repository<RoleEntity>,
    @InjectRepository(AppSettingEntity) private readonly settings: Repository<AppSettingEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      // Top up rather than seed-once: a role added after the table was first
      // filled would otherwise never appear on an existing install. Only
      // missing keys are inserted, so edited permissions are left alone.
      const existing = new Set((await this.repo.find()).map((r) => r.key));
      const missing = DEFAULT_ROLES.filter((r) => !existing.has(r.key));
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
   * Once: the Site Superintendent role sees only the dashboard, projects,
   * tasks and the File Room. After that it's edited like any other role.
   */
  async trimSiteSuper() {
    if (await this.settings.findOneBy({ key: SITE_SUPER_TRIM_KEY })) return;
    const role = await this.repo.findOneBy({ key: 'site_super' });
    if (role) {
      role.permissions = SITE_SUPER_PERMISSIONS;
      await this.repo.save(role);
      this.log.log('Site Superintendent role trimmed to dashboard, projects, tasks and File Room');
    }
    await this.settings.save({ key: SITE_SUPER_TRIM_KEY, value: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  findAll() {
    return this.repo.find({ order: { order: 'ASC' } });
  }

  create(dto: any) {
    const key = dto.key || 'role_' + Date.now();
    const role = { order: 999, isSystem: false, description: '', permissions: {}, ...dto, key };
    return this.repo.save(this.repo.create(role as Partial<RoleEntity>));
  }

  async update(key: string, dto: any) {
    let role = await this.repo.findOneBy({ key });
    if (!role) role = this.repo.create({ key } as Partial<RoleEntity>);
    Object.assign(role, dto, { key });
    return this.repo.save(role);
  }

  async remove(key: string) {
    const role = await this.repo.findOneBy({ key });
    if (role?.isSystem) throw new NotFoundException(`Role ${key} is protected`);
    if (role) await this.repo.remove(role);
    return { key, deleted: true };
  }
}
