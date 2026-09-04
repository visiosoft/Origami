import { Injectable, OnApplicationBootstrap, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from '../database/entities';
import { DEFAULT_ROLES } from '../seed-data/users';

@Injectable()
export class RolesService implements OnApplicationBootstrap {
  private readonly log = new Logger('RolesService');

  constructor(
    @InjectRepository(RoleEntity) private readonly repo: Repository<RoleEntity>,
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
    } catch (err) {
      this.log.error('Roles seed failed: ' + (err as Error).message);
    }
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
