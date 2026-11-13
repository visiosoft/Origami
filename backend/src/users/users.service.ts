import { cleanAltEmails, normEmail, sharesEmail } from '../common/emails';
import { Optional, Injectable, OnApplicationBootstrap, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, ProjectTaskEntity, TaskEntity, PersonEntity } from '../database/entities';
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
    @Optional() @InjectRepository(PersonEntity) private readonly people?: Repository<PersonEntity>,
  ) {}

  // ---------------------------------------------------------------- logins and People (Oct 30 sync)
  // Projects are given to a person through their People record, so a login
  // without one can't be given any project. Each login is tied to one.

  /** The People record for a login: the one given from it (userId), else the one with its email. */
  private async personFor(user: Pick<UserEntity, 'id' | 'email'> & { altEmails?: string[] | null }, all?: PersonEntity[]) {
    const rows = all || (await this.people!.find());
    return rows.find((p) => p.userId === user.id) || rows.find((p) => sharesEmail(p, user));
  }

  /** Tie a login to People: link the matching record, or add one (Staff for the team, Client / Consultant otherwise). */
  async linkPerson(user: Pick<UserEntity, 'id' | 'email' | 'name' | 'tier'>, all?: PersonEntity[]) {
    if (!this.people || String(user.id).startsWith('GUEST-')) return null;
    const found = await this.personFor(user, all);
    if (found) {
      if (!found.userId) { found.userId = user.id; await this.people.save(found); }
      return found;
    }
    const rows = all || (await this.people.find());
    const id = rows.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;
    const tier = user.tier === 'client' ? 'Client' : user.tier === 'consultant' ? 'Consultant' : 'Internal';
    const made = this.people.create({
      id, name: user.name || user.email, email: String(user.email || '').trim(), userId: user.id, tier,
      kind: tier === 'Internal' ? 'Staff' : tier, role: '', company: '', phone: '',
      projects: [], openTasks: 0, since: new Date().toISOString().slice(0, 10), comply: null, last: 'Login created',
    } as Partial<PersonEntity>);
    const saved = await this.people.save(made);
    rows.push(saved);
    return saved;
  }

  /** Logins with no People record (so no projects can be given to them). */
  async unlinked() {
    if (!this.people) return [];
    const [users, people] = await Promise.all([this.repo.find(), this.people.find()]);
    const out = [];
    for (const u of users) if (!String(u.id).startsWith('GUEST-') && !(await this.personFor(u, people))) out.push({ id: u.id, name: u.name, email: u.email, tier: u.tier, roleKey: u.roleKey });
    return out;
  }

  /** Add every unlinked login to People (an admin presses this; nothing runs on its own). */
  async linkAllPeople() {
    if (!this.people) return { linked: 0 };
    const [users, people] = await Promise.all([this.repo.find(), this.people.find()]);
    let linked = 0;
    for (const u of users) {
      if (String(u.id).startsWith('GUEST-')) continue;
      const had = await this.personFor(u, people);
      if (had && had.userId === u.id) continue;
      await this.linkPerson(u, people);
      linked++;
    }
    return { linked };
  }

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

  /** Staff who can be given or follow work: active or invited, not portal or guest accounts. */
  async directory() {
    const rows = await this.repo.find();
    return rows
      .filter((u) => u.tier === 'internal' && u.status !== 'suspended' && !String(u.id).startsWith('GUEST-'))
      .map((u) => ({ id: u.id, name: u.name, email: u.email, tier: u.tier, roleKey: u.roleKey, status: u.status, avatarUrl: u.avatarUrl, createdAt: u.createdAt }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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

  /** Other emails (Nov 13): cleaned, and none may belong to another account. */
  private async cleanAlt(list: unknown, main: string, exceptId?: string) {
    const alt = cleanAltEmails(list, main);
    for (const e of alt) {
      const other = await this.auth.findByEmail(e);
      if (other && other.id !== exceptId) throw new ConflictException(`${e} already belongs to ${other.name || other.email}.`);
    }
    return alt;
  }

  async create(dto: any) {
    await this.assertEmailFree(dto?.email);
    if (dto && 'altEmails' in dto) dto = { ...dto, altEmails: await this.cleanAlt(dto.altEmails, dto.email) };
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
    // Every new login gets its People record, so it can be given projects straight away.
    await this.linkPerson(saved).catch((err: Error) => this.log.warn(`Could not add ${saved.email} to People: ${err.message}`));

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
    const { passwordHash, inviteToken, hasPassword, invitePending, invite, totpSecret, totpPending, totpEnabledAt, totpLastStep, backupCodes, trustedDevices, twoFactor, backupCodesLeft, ...safe } = dto ?? {};
    void totpSecret; void totpPending; void totpEnabledAt; void totpLastStep; void backupCodes; void trustedDevices; void twoFactor; void backupCodesLeft;
    if ('altEmails' in safe) safe.altEmails = await this.cleanAlt(safe.altEmails, normEmail(safe.email || user.email), id);
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
