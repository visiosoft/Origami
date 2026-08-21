import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, RoleEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService, type GoogleProfile } from '../google/google.service';
import { inviteEmail, resetEmail } from './email.templates';
import { FOUNDER_ADMIN } from '../seed-data/users';
import {
  hashPassword, verifyPassword, passwordProblem,
  randomToken, hashToken, signJwt, verifyJwt, type SessionClaims,
} from './crypto.util';

const SESSION_TTL_SECONDS = 12 * 60 * 60;     // 12h session
const INVITE_TTL_DAYS = 7;
const RESET_TTL_HOURS = 2;

/** The shape of a user the client is allowed to see — no secrets. */
export function publicUser(u: UserEntity) {
  const { passwordHash, inviteToken, ...rest } = u as any;
  return { ...rest, hasPassword: !!passwordHash, invitePending: !!inviteToken };
}

@Injectable()
export class AuthService {
  private readonly log = new Logger('AuthService');

  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(RoleEntity) private readonly roles: Repository<RoleEntity>,
    private readonly settings: SettingsService,
    private readonly google: GoogleService,
  ) {}

  /**
   * Create the founding administrator if that address has no account yet.
   * Never touches an existing one, so a changed password is not reset on deploy.
   */
  private async ensureFounderAdmin() {
    const existing = await this.findByEmail(FOUNDER_ADMIN.email);
    if (existing) return;
    await this.users.save(this.users.create({
      ...FOUNDER_ADMIN,
      passwordSetAt: new Date().toISOString(),
      createdAt: new Date().toISOString().slice(0, 10),
    } as Partial<UserEntity>));
    this.log.warn(`Created founding admin ${FOUNDER_ADMIN.email} — change its password after first sign-in.`);
  }

  /**
   * Make sure at least one account can sign in.
   *
   * The founding admin is created if its address is missing (its password ships
   * as a scrypt hash, never plaintext). BOOTSTRAP_ADMIN_EMAIL +
   * BOOTSTRAP_ADMIN_PASSWORD override it when set — useful for a fresh
   * environment, or to recover if the founder password is changed and lost.
   */
  async ensureBootstrapAdmin() {
    await this.ensureFounderAdmin();

    const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
    if (!email || !password) return;
    if (passwordProblem(password)) {
      this.log.warn('BOOTSTRAP_ADMIN_PASSWORD is too weak — skipping bootstrap admin.');
      return;
    }
    let user = await this.findByEmail(email);
    if (!user) {
      user = this.users.create({
        id: 'U-ADMIN',
        name: email.split('@')[0],
        email,
        tier: 'internal',
        roleKey: 'admin',
        status: 'active',
        createdAt: new Date().toISOString().slice(0, 10),
      } as Partial<UserEntity>);
    }
    user.passwordHash = hashPassword(password);
    user.passwordSetAt = new Date().toISOString();
    user.status = 'active';
    await this.users.save(user);
    this.log.warn(`Bootstrap admin ready: ${email} — remove BOOTSTRAP_ADMIN_* once you've signed in.`);
  }

  // ------------------------------------------------------------- invitations

  /**
   * Issue a fresh invite/reset token for a user and email them the link.
   * Returns the link so the caller can surface it when mail isn't configured yet.
   */
  async sendInvite(user: UserEntity, kind: 'invite' | 'reset' = 'invite') {
    const token = randomToken();
    const ttlMs = kind === 'invite' ? INVITE_TTL_DAYS * 864e5 : RESET_TTL_HOURS * 36e5;
    user.inviteToken = hashToken(token);
    user.inviteSentAt = new Date().toISOString();
    user.inviteExpiresAt = new Date(Date.now() + ttlMs).toISOString();
    await this.users.save(user);

    const base = await this.settings.baseUrl();
    if (!base) {
      throw new BadRequestException(
        'App base URL is not set. Add it under Settings -> Integrations -> Google Workspace before inviting users.',
      );
    }
    const url = `${base}/set-password?token=${encodeURIComponent(token)}`;

    const role = await this.roles.findOneBy({ key: user.roleKey });
    const mail = kind === 'invite'
      ? inviteEmail({ name: user.name, url, roleName: role?.name || user.roleKey || 'team member', expiresInDays: INVITE_TTL_DAYS })
      : resetEmail({ name: user.name, url, expiresInHours: RESET_TTL_HOURS });

    try {
      await this.google.sendMail({ to: user.email, subject: mail.subject, html: mail.html });
      return { sent: true as const, to: user.email, url };
    } catch (err) {
      // The token is still valid — surface the link so an admin can pass it on.
      this.log.warn(`Invite email to ${user.email} could not be sent: ${(err as Error).message}`);
      return { sent: false as const, to: user.email, url, error: (err as Error).message };
    }
  }

  /** Look up an invite/reset token without consuming it (for the set-password screen). */
  async readInvite(token: string) {
    const user = await this.users.findOneBy({ inviteToken: hashToken(token) });
    if (!user) throw new BadRequestException('This link is not valid. Ask an administrator for a new invitation.');
    if (user.inviteExpiresAt && new Date(user.inviteExpiresAt).getTime() < Date.now()) {
      throw new BadRequestException('This link has expired. Ask an administrator to send a new invitation.');
    }
    return { name: user.name, email: user.email, isReset: !!user.passwordHash };
  }

  /** Consume the token and set the password. The account becomes active. */
  async setPassword(token: string, password: string) {
    const problem = passwordProblem(password);
    if (problem) throw new BadRequestException(problem);

    const user = await this.users.findOneBy({ inviteToken: hashToken(token) });
    if (!user) throw new BadRequestException('This link is not valid. Ask an administrator for a new invitation.');
    if (user.inviteExpiresAt && new Date(user.inviteExpiresAt).getTime() < Date.now()) {
      throw new BadRequestException('This link has expired. Ask an administrator to send a new invitation.');
    }

    user.passwordHash = hashPassword(password);
    user.passwordSetAt = new Date().toISOString();
    user.inviteToken = null as any;
    user.inviteExpiresAt = null as any;
    if (user.status === 'pending') user.status = 'active';
    await this.users.save(user);
    this.log.log(`Password set for ${user.email}`);
    return { ok: true, email: user.email };
  }

  /** Email a reset link. Always reports success so addresses can't be probed. */
  async forgotPassword(email: string) {
    const user = await this.findByEmail(email);
    if (user && user.status !== 'suspended') await this.sendInvite(user, 'reset');
    return { ok: true };
  }

  // -------------------------------------------------------------------- login

  async login(email: string, password: string) {
    const user = await this.findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    return this.issueSession(user);
  }

  /** Sign in (or link) a user from a verified Google profile. */
  async loginWithGoogle(profile: GoogleProfile) {
    if (!profile.email) throw new UnauthorizedException('Google did not return an email address.');
    const user = await this.findByEmail(profile.email);
    if (!user) {
      throw new UnauthorizedException(
        `No Origami account exists for ${profile.email}. Ask an administrator to invite you first.`,
      );
    }
    if (!user.googleId) user.googleId = profile.sub;
    if (profile.picture) user.avatarUrl = profile.picture;
    if (user.status === 'pending') {
      // Signing in with Google proves they own the mailbox, so the invite is fulfilled.
      user.status = 'active';
      user.inviteToken = null as any;
      user.inviteExpiresAt = null as any;
    }
    await this.users.save(user);
    return this.issueSession(user);
  }

  private async issueSession(user: UserEntity) {
    if (user.status === 'suspended') throw new UnauthorizedException('This account is suspended.');
    if (user.status === 'pending') {
      throw new UnauthorizedException('This account is not active yet — use the invitation link to set a password.');
    }
    user.lastLogin = new Date().toISOString();
    await this.users.save(user);

    const secret = await this.settings.jwtSecret();
    const token = signJwt(
      { sub: user.id, email: user.email, name: user.name, roleKey: user.roleKey, tier: user.tier },
      secret,
      SESSION_TTL_SECONDS,
    );
    return { token, expiresIn: SESSION_TTL_SECONDS, user: publicUser(user) };
  }

  // -------------------------------------------------------------------- misc

  async verify(bearer: string | undefined): Promise<SessionClaims | null> {
    const raw = bearer?.startsWith('Bearer ') ? bearer.slice(7) : bearer;
    if (!raw) return null;
    return verifyJwt(raw, await this.settings.jwtSecret());
  }

  /**
   * Who is making this request, for attribution on comments and history.
   * The API has no global guard, so an unsigned request is attributed rather
   * than rejected — see requireActor() for the endpoints that must know.
   */
  async actor(bearer: string | undefined): Promise<{ name: string; id?: string }> {
    const claims = await this.verify(bearer);
    return claims ? { name: claims.name, id: claims.sub } : { name: 'Unknown' };
  }

  /** Same, but rejects anonymous callers — used where the action costs storage. */
  async requireActor(bearer: string | undefined): Promise<{ name: string; id?: string }> {
    const claims = await this.verify(bearer);
    if (!claims) throw new UnauthorizedException('Sign in to upload files.');
    return { name: claims.name, id: claims.sub };
  }

  async me(bearer: string | undefined) {
    const claims = await this.verify(bearer);
    if (!claims) throw new UnauthorizedException('Not signed in.');
    const user = await this.users.findOneBy({ id: claims.sub });
    if (!user) throw new UnauthorizedException('Not signed in.');
    return publicUser(user);
  }

  findByEmail(email: string) {
    return this.users
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email: (email || '').trim().toLowerCase() })
      .getOne();
  }
}
