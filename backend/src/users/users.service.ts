import { Injectable, OnApplicationBootstrap, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities';
import { DEFAULT_USERS } from '../seed-data/users';
import { AuthService, publicUser } from '../auth/auth.service';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly log = new Logger('UsersService');

  constructor(
    @InjectRepository(UserEntity) private readonly repo: Repository<UserEntity>,
    private readonly auth: AuthService,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_USERS as unknown as UserEntity[]);
        this.log.log(`Seeded ${DEFAULT_USERS.length} users`);
      }
      // Runs after the seed so the first admin always has a working password.
      await this.auth.ensureBootstrapAdmin();
    } catch (err) {
      this.log.error('Users seed failed: ' + (err as Error).message);
    }
  }

  async findAll() {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    return rows.map(publicUser);
  }

  /**
   * Create a user and email them a link to choose their own password.
   * New accounts start as `pending` and become `active` once that link is used
   * (or once they sign in with Google using the same address).
   */
  async create(dto: any) {
    const id = dto.id || 'U-' + String(1000 + (Date.now() % 9000));
    const user = this.repo.create({
      status: 'pending',
      tier: 'internal',
      createdAt: new Date().toISOString().slice(0, 10),
      ...dto,
      id,
      email: String(dto.email || '').trim(),
    } as Partial<UserEntity>);
    const saved = await this.repo.save(user);

    let invite: { sent: boolean; url?: string; error?: string } = { sent: false };
    try {
      invite = await this.auth.sendInvite(saved, 'invite');
    } catch (err) {
      invite = { sent: false, error: (err as Error).message };
      this.log.warn(`Could not invite ${saved.email}: ${(err as Error).message}`);
    }
    return { ...publicUser(saved), invite };
  }

  /** Send (or re-send) the "set your password" invitation. */
  async resendInvite(id: string) {
    const user = await this.repo.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    const invite = await this.auth.sendInvite(user, user.passwordHash ? 'reset' : 'invite');
    return { ...publicUser(user), invite };
  }

  async update(id: string, dto: any) {
    let user = await this.repo.findOneBy({ id });
    if (!user) user = this.repo.create({ id, createdAt: new Date().toISOString().slice(0, 10) } as Partial<UserEntity>);
    // Credentials are only ever changed through the auth flows, never a plain update.
    const { passwordHash, inviteToken, hasPassword, invitePending, invite, ...safe } = dto ?? {};
    Object.assign(user, safe, { id });
    return publicUser(await this.repo.save(user));
  }

  async remove(id: string) {
    const user = await this.repo.findOneBy({ id });
    if (user) await this.repo.remove(user);
    return { id, deleted: true };
  }
}
