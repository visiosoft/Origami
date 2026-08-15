import { Injectable, Optional, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities';
import { DEFAULT_USERS, UserSeed } from '../seed-data/users';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly log = new Logger('UsersService');
  private mem: UserSeed[] = DEFAULT_USERS.map((u) => ({ ...u }));

  constructor(
    @Optional() @InjectRepository(UserEntity) private readonly repo?: Repository<UserEntity>,
  ) {}

  async onApplicationBootstrap() {
    if (!this.repo) return;
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_USERS as unknown as UserEntity[]);
        this.log.log(`Seeded ${DEFAULT_USERS.length} users`);
      }
    } catch (err) {
      this.log.error('Users seed failed: ' + (err as Error).message);
    }
  }

  async findAll() {
    if (!this.repo) return this.mem.slice();
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  create(dto: any) {
    const id = dto.id || 'U-' + String(1000 + (Date.now() % 9000));
    const user = { status: 'active', tier: 'internal', createdAt: new Date().toISOString().slice(0, 10), ...dto, id };
    if (!this.repo) { this.mem = [user, ...this.mem]; return user; }
    return this.repo.save(this.repo.create(user as Partial<UserEntity>));
  }

  async update(id: string, dto: any) {
    if (!this.repo) {
      this.mem = this.mem.map((u) => (u.id === id ? { ...u, ...dto, id } : u));
      return this.mem.find((u) => u.id === id);
    }
    let user = await this.repo.findOneBy({ id });
    if (!user) user = this.repo.create({ id, createdAt: new Date().toISOString().slice(0, 10) } as Partial<UserEntity>);
    Object.assign(user, dto, { id });
    return this.repo.save(user);
  }

  async remove(id: string) {
    if (!this.repo) { this.mem = this.mem.filter((u) => u.id !== id); return { id, deleted: true }; }
    const user = await this.repo.findOneBy({ id });
    if (user) await this.repo.remove(user);
    return { id, deleted: true };
  }
}
