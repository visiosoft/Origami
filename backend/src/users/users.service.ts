import { Injectable, OnApplicationBootstrap, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, ProjectTaskEntity, TaskEntity } from '../database/entities';
import { DEFAULT_USERS } from '../seed-data/users';
import { AuthService, publicUser } from '../auth/auth.service';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly log = new Logger('UsersService');

  constructor(
    @InjectRepository(UserEntity) private readonly repo: Repository<UserEntity>,
    @InjectRepository(ProjectTaskEntity) private readonly projectTasks: Repository<ProjectTaskEntity>,
    @InjectRepository(TaskEntity) private readonly tasks: Repository<TaskEntity>,
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
  /**
   * Accounts are identified by email everywhere — login, Google sign-in,
   * invitations — so two rows sharing one address means an arbitrary pick at
   * sign-in time. Reject the duplicate instead.
   */
  private async assertEmailFree(email: string, exceptId?: string) {
    const clean = (email || '').trim();
    if (!clean) throw new ConflictException('An email address is required.');
    const existing = await this.auth.findByEmail(clean);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(`${clean} already has an account. Use "Resend invite" on that row instead.`);
    }
  }

  async create(dto: any) {
    await this.assertEmailFree(dto?.email);
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
    const previousName = user.name;
    if (dto?.email && dto.email.trim().toLowerCase() !== (user.email || '').trim().toLowerCase()) {
      await this.assertEmailFree(dto.email, id);
    }
    // Credentials are only ever changed through the auth flows, never a plain update.
    const { passwordHash, inviteToken, hasPassword, invitePending, invite, ...safe } = dto ?? {};
    Object.assign(user, safe, { id });
    const saved = await this.repo.save(user);

    // Tasks store the assignee's name alongside their id for display. Keep that
    // copy current, otherwise a rename leaves tasks labelled with the old name.
    if (previousName && saved.name && previousName !== saved.name) {
      await this.renameOnTasks(saved.id, saved.name);
    }
    return publicUser(saved);
  }

  private async renameOnTasks(userId: string, name: string) {
    try {
      await this.projectTasks.update({ assigneeId: userId }, { assignee: name });
      await this.tasks.update({ assignedToId: userId }, { assignedTo: name });
    } catch (err) {
      this.log.warn(`Could not propagate the rename of ${userId}: ${(err as Error).message}`);
    }
  }

  async remove(id: string) {
    const user = await this.repo.findOneBy({ id });
    if (user) await this.repo.remove(user);
    return { id, deleted: true };
  }
}
