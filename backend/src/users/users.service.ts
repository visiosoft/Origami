import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities';
import { DEFAULT_USERS } from '../seed-data/users';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly log = new Logger('UsersService');

  constructor(
    @InjectRepository(UserEntity) private readonly repo: Repository<UserEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_USERS as unknown as UserEntity[]);
        this.log.log(`Seeded ${DEFAULT_USERS.length} users`);
      }
    } catch (err) {
      this.log.error('Users seed failed: ' + (err as Error).message);
    }
  }

  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  create(dto: any) {
    const id = dto.id || 'U-' + String(1000 + (Date.now() % 9000));
    const user = { status: 'active', tier: 'internal', createdAt: new Date().toISOString().slice(0, 10), ...dto, id };
    return this.repo.save(this.repo.create(user as Partial<UserEntity>));
  }

  async update(id: string, dto: any) {
    let user = await this.repo.findOneBy({ id });
    if (!user) user = this.repo.create({ id, createdAt: new Date().toISOString().slice(0, 10) } as Partial<UserEntity>);
    Object.assign(user, dto, { id });
    return this.repo.save(user);
  }

  async remove(id: string) {
    const user = await this.repo.findOneBy({ id });
    if (user) await this.repo.remove(user);
    return { id, deleted: true };
  }
}
