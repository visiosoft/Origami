import { Injectable, Optional, OnApplicationBootstrap, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from '../database/entities';
import { DEFAULT_ROLES, RoleSeed } from '../seed-data/users';

@Injectable()
export class RolesService implements OnApplicationBootstrap {
  private readonly log = new Logger('RolesService');
  private mem: RoleSeed[] = DEFAULT_ROLES.map((r) => ({ ...r }));

  constructor(
    @Optional() @InjectRepository(RoleEntity) private readonly repo?: Repository<RoleEntity>,
  ) {}

  async onApplicationBootstrap() {
    if (!this.repo) return;
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_ROLES as unknown as RoleEntity[]);
        this.log.log(`Seeded ${DEFAULT_ROLES.length} roles`);
      }
    } catch (err) {
      this.log.error('Roles seed failed: ' + (err as Error).message);
    }
  }

  async findAll() {
    if (this.repo) {
      try { return await this.repo.find({ order: { order: 'ASC' } }); }
      catch (err) { this.log.error('roles.find failed, using seed: ' + (err as Error).message); }
    }
    return this.mem.slice().sort((a, b) => a.order - b.order);
  }

  create(dto: any) {
    const key = dto.key || 'role_' + Date.now();
    const role = { order: 999, isSystem: false, description: '', permissions: {}, ...dto, key };
    if (!this.repo) { this.mem = [...this.mem, role]; return role; }
    return this.repo.save(this.repo.create(role as Partial<RoleEntity>));
  }

  async update(key: string, dto: any) {
    if (!this.repo) {
      this.mem = this.mem.map((r) => (r.key === key ? { ...r, ...dto, key } : r));
      return this.mem.find((r) => r.key === key);
    }
    let role = await this.repo.findOneBy({ key });
    if (!role) role = this.repo.create({ key } as Partial<RoleEntity>);
    Object.assign(role, dto, { key });
    return this.repo.save(role);
  }

  async remove(key: string) {
    if (!this.repo) {
      const role = this.mem.find((r) => r.key === key);
      if (role?.isSystem) throw new NotFoundException(`Role ${key} is protected`);
      this.mem = this.mem.filter((r) => r.key !== key);
      return { key, deleted: true };
    }
    const role = await this.repo.findOneBy({ key });
    if (role && !role.isSystem) await this.repo.remove(role);
    return { key, deleted: true };
  }
}
