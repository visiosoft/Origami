import { emailsOf, normEmail, sharesEmail } from '../common/emails';
import { SUPER_ROLES } from '../users/role-merge';
import { BadRequestException, Injectable, Logger, Optional, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, RoleEntity, GuestAccessEntity, EmployeeEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService, type GoogleProfile } from '../google/google.service';
import { inviteEmail, resetEmail } from './email.templates';
import { loadEmailBrand } from '../email/shell';
import { FOUNDER_ADMIN } from '../seed-data/users';
import { effectivePermissions } from '../users/access-levels';
import {
  hashPassword, verifyPassword, passwordProblem,
  randomToken, hashToken, signJwt, verifyJwt, signState, readState, type SessionClaims,
} from './crypto.util';
import { parseViewAs, viewAsStore } from './view-as';
import { checkTotp, newBackupCodes, newTotpSecret, normBackupCode, openSecret, otpauthUri, sealSecret } from './totp';
import { OTP_MS, allowedMethods, canSend, maskTo, newOtp, otpHash, otpValid, type TwoFactorMethod } from './otp';
import { SmsService, normalizeNumber } from '../sms/sms.service';

/** Two-step sign-in (Nov 13): the step between password / Google and a session. */
export type TwoFactorStep = { twoFactor: 'setup' | 'code'; ticket: string; name: string; email: string; method?: TwoFactorMethod; methods?: TwoFactorMethod[]; sentTo?: string };
const TICKET_MS = 10 * 60_000;
const DEVICE_DAYS = 30;
const MAX_TRIES = 5;
const LOCK_MS = 10 * 60_000;

const SESSION_TTL_SECONDS = 12 * 60 * 60;     // 12h session
const INVITE_TTL_DAYS = 7;
const RESET_TTL_HOURS = 2;

/** The shape of a user the client is allowed to see — no secrets. */
export function publicUser(u: UserEntity) {
  const { passwordHash, inviteToken, calendarRefreshToken, totpSecret, totpPending, totpLastStep, backupCodes, trustedDevices, otpHash: _h, otpExpiresAt: _e, otpSends: _s, otpPending: _p, ...rest } = u as any;
  void totpSecret; void totpPending; void totpLastStep; void trustedDevices; void _h; void _e; void _s; void _p;
  return { ...rest, hasPassword: !!passwordHash, invitePending: !!inviteToken, calendarConnected: !!calendarRefreshToken, twoFactor: !!u.totpEnabledAt, backupCodesLeft: Array.isArray(backupCodes) ? backupCodes.length : 0 };
}

@Injectable()
export class AuthService {
  private readonly log = new Logger('AuthService');

  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(RoleEntity) private readonly roles: Repository<RoleEntity>,
    @InjectRepository(GuestAccessEntity) private readonly guestAccess: Repository<GuestAccessEntity>,
    private readonly settings: SettingsService,
    private readonly google: GoogleService,
    @InjectRepository(EmployeeEntity) private readonly employees?: Repository<EmployeeEntity>,
    @Optional() private readonly sms?: SmsService,
  ) {}

  /**
   * Whether this account runs a site: the Site Superintendent role, or an
   * employee record (linked to the login, or with the same email) whose
   * designation or job title says superintendent -- e.g. "Super Intendent -
   * Construction". Decides who gets the phone daily log.
   */
  private async isSuperintendent(user: UserEntity) {
    if (SUPER_ROLES.includes(user.roleKey)) return true;
    if (!this.employees) return false;
    const rows = await this.employees.find();
    const emp = rows.find((e) => e.userId === user.id) || rows.find((e) => sharesEmail(e, user));
    return /super\s*-?\s*intend/i.test(`${emp?.designation || ''} ${emp?.jobTitle || ''}`);
  }

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
    const brand = await loadEmailBrand(this.settings);
    const mail = kind === 'invite'
      ? inviteEmail({ name: user.name, url, roleName: role?.name || user.roleKey || 'team member', expiresInDays: INVITE_TTL_DAYS, brand })
      : resetEmail({ name: user.name, url, expiresInHours: RESET_TTL_HOURS, brand });

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

  /**
   * Email a reset link.
   *
   * Whether the platform can send mail at all is a property of the workspace,
   * not of the submitted address, so reporting that discloses nothing about who
   * has an account — and it beats telling someone a link is on its way when no
   * mailbox is connected. Beyond that check the answer is always the same, so
   * the form can't be used to discover which addresses exist.
   */
  async forgotPassword(email: string) {
    const canSend = (await this.google.isConnected()) && !!(await this.settings.baseUrl());
    if (!canSend) {
      this.log.warn('Password reset requested but no mailbox is connected.');
      return { ok: false as const, reason: 'unavailable' as const };
    }

    const user = await this.findByEmail(email);
    if (user && user.status !== 'suspended') {
      // A failure for this particular address stays silent: surfacing it would
      // reveal whether the account exists.
      try {
        await this.sendInvite(user, 'reset');
      } catch (err) {
        this.log.warn(`Reset email to ${email} failed: ${(err as Error).message}`);
      }
    }
    return { ok: true as const };
  }

  // -------------------------------------------------------------------- login

  async login(email: string, password: string, deviceToken?: string | null) {
    const user = await this.findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    return this.startSession(user, deviceToken);
  }

  // ---------------------------------------------------------- two-step sign-in (Nov 13)

  /** Staff need a code from an authenticator app; clients, subs and guests don't. Settings `auth.twoFactor` = off turns it off. */
  async needsTwoFactor(user: UserEntity) {
    if (user.tier !== 'internal' || String(user.id).startsWith('GUEST-')) return false;
    return (await this.settings.get('auth.twoFactor')) !== 'off';
  }

  /**
   * After the password or Google: a session, or -- for staff -- a ticket for
   * the second step (set up the app, or enter its code). A remembered device
   * goes straight through.
   */
  async startSession(user: UserEntity, deviceToken?: string | null): Promise<Awaited<ReturnType<AuthService['issueSession']>> | TwoFactorStep> {
    if (user.status === 'suspended') throw new UnauthorizedException('This account is suspended.');
    if (!(await this.needsTwoFactor(user))) return this.issueSession(user);
    if (user.totpEnabledAt && deviceToken && this.trusted(user, deviceToken)) return this.issueSession(user);
    const ticket = signState({ mode: '2fa', uid: user.id }, await this.settings.jwtSecret());
    const method = this.methodOf(user);
    return {
      twoFactor: user.totpEnabledAt ? 'code' : 'setup', ticket, name: user.name, email: user.email, method,
      methods: allowedMethods(await this.settings.get('auth.twoFactorMethods')),
      sentTo: user.totpEnabledAt && method !== 'app' ? maskTo(method, method === 'sms' ? user.twoFactorPhone || '' : user.email) : undefined,
    };
  }

  /** What the second step looks like for this ticket (the screen asks, whichever way they signed in). */
  async twoFactorInfo(ticket: string) {
    const user = await this.fromTicket(ticket);
    const method = this.methodOf(user);
    return {
      step: user.totpEnabledAt ? 'code' : 'setup', method,
      methods: allowedMethods(await this.settings.get('auth.twoFactorMethods')),
      sentTo: user.totpEnabledAt && method !== 'app' ? maskTo(method, method === 'sms' ? user.twoFactorPhone || '' : user.email) : undefined,
    };
  }

  private methodOf(u: UserEntity): TwoFactorMethod {
    return u.twoFactorMethod === 'sms' || u.twoFactorMethod === 'email' ? u.twoFactorMethod : 'app';
  }

  /** Text or email a fresh code (Nov 13): rate-limited; only the newest works. */
  private async sendCode(user: UserEntity, method: 'sms' | 'email', to: string) {
    const gate = canSend(user.otpSends);
    if (!gate.ok) throw new BadRequestException(`Wait ${gate.wait} seconds before asking for another code.`);
    const code = newOtp();
    Object.assign(user, { otpHash: otpHash(user.id, code), otpExpiresAt: new Date(Date.now() + OTP_MS).toISOString(), otpSends: gate.keep });
    if (method === 'sms') {
      if (!this.sms) throw new BadRequestException('Texting isn’t set up.');
      await this.sms.send({ to, body: `${code} is your Origami sign-in code. It works for 10 minutes. Don’t share it.`, category: 'security' });
    } else {
      await this.google.sendMail({ to, subject: `${code} is your Origami sign-in code`, html: `<p>Your sign-in code is</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It works for 10 minutes. If you didn’t try to sign in, change your password.</p>`, text: `Your Origami sign-in code is ${code}. It works for 10 minutes.` });
    }
    await this.users.save(user);
    return { sentTo: maskTo(method, to) };
  }

  private async methodAllowed(m: string): Promise<TwoFactorMethod> {
    const ok = allowedMethods(await this.settings.get('auth.twoFactorMethods'));
    if (!(ok as string[]).includes(m)) throw new BadRequestException('That way of getting codes isn’t available.');
    return m as TwoFactorMethod;
  }

  /**
   * Send a code during sign-in: to their chosen number or email, or -- while
   * setting up -- to the method and number they picked (kept as pending).
   */
  async twoFactorSend(ticket: string, choice?: { method?: string; phone?: string }) {
    const user = await this.fromTicket(ticket);
    let method: TwoFactorMethod; let phone = user.twoFactorPhone;
    if (user.totpEnabledAt) method = this.methodOf(user);
    else {
      method = await this.methodAllowed(String(choice?.method || ''));
      if (method === 'sms') phone = normalizeNumber(String(choice?.phone || ''));
      user.otpPending = { method, phone: method === 'sms' ? phone : null };
    }
    if (method === 'app') throw new BadRequestException('Use the code from your authenticator app.');
    if (method === 'sms' && (!phone || phone.length < 8)) throw new BadRequestException('Enter a mobile number for the codes.');
    return this.sendCode(user, method, method === 'sms' ? phone! : user.email);
  }

  private trusted(user: UserEntity, deviceToken: string) {
    const h = hashToken(deviceToken);
    return (user.trustedDevices || []).some((d) => d.hash === h && Date.parse(d.expiresAt) > Date.now());
  }

  private tries = new Map<string, { fails: number; lockedUntil: number }>();
  private async fromTicket(ticket: string) {
    const st = readState(String(ticket || ''), await this.settings.jwtSecret(), TICKET_MS);
    if (!st || st.mode !== '2fa' || !st.uid) throw new UnauthorizedException('That sign-in took too long. Sign in again.');
    const user = await this.users.findOneBy({ id: String(st.uid) });
    if (!user) throw new UnauthorizedException('Sign in again.');
    const t = this.tries.get(user.id);
    if (t && t.lockedUntil > Date.now()) throw new UnauthorizedException(`Too many wrong codes. Try again in ${Math.ceil((t.lockedUntil - Date.now()) / 60_000)} minutes.`);
    return user;
  }
  private failed(user: UserEntity, msg = 'That code isn’t right. Check the time on your phone and try the newest code.'): never {
    const t = this.tries.get(user.id) || { fails: 0, lockedUntil: 0 };
    t.fails++;
    if (t.fails >= MAX_TRIES) { t.fails = 0; t.lockedUntil = Date.now() + LOCK_MS; }
    this.tries.set(user.id, t);
    throw new UnauthorizedException(msg);
  }

  /** Step 1 of setting up: a new secret for the authenticator app (shown as a QR code and as text). */
  async twoFactorSetup(ticket: string) {
    const user = await this.fromTicket(ticket);
    if (user.totpEnabledAt) throw new BadRequestException('Two-step sign-in is already set up -- enter the code from your app.');
    const secret = newTotpSecret();
    user.totpPending = sealSecret(secret, await this.settings.jwtSecret());
    await this.users.save(user);
    return { secret, uri: otpauthUri(secret, user.email), account: user.email };
  }

  /** Step 2: the first code proves the app works; backup codes are shown once; signed in. */
  async twoFactorEnable(ticket: string, code: string, deviceLabel?: string, remember = false, method: string = 'app') {
    const user = await this.fromTicket(ticket);
    if (user.totpEnabledAt) throw new BadRequestException('Two-step sign-in is already set up.');
    // By text or email (Nov 13): the code sent to the method they picked proves it.
    if (method === 'sms' || method === 'email') {
      if (user.otpPending?.method !== method || !otpValid(user, code)) this.failed(user, 'That code isn’t right, or has run out. Ask for a new one.');
      const codes = newBackupCodes();
      Object.assign(user, {
        twoFactorMethod: method, twoFactorPhone: method === 'sms' ? user.otpPending!.phone : user.twoFactorPhone, otpPending: null, otpHash: null, otpExpiresAt: null,
        totpSecret: null, totpPending: null, totpEnabledAt: new Date().toISOString(), backupCodes: codes.map((c) => hashPassword(normBackupCode(c))),
      });
      this.tries.delete(user.id);
      const deviceToken = remember ? this.rememberDevice(user, deviceLabel) : null;
      await this.users.save(user);
      return { ...(await this.issueSession(user)), backupCodes: codes, deviceToken };
    }
    const server = await this.settings.jwtSecret();
    const secret = user.totpPending ? openSecret(user.totpPending, server) : null;
    if (!secret) throw new BadRequestException('Start the set-up again.');
    const step = checkTotp(secret, code);
    if (step == null) this.failed(user);
    const codes = newBackupCodes();
    Object.assign(user, { twoFactorMethod: 'app', totpSecret: user.totpPending, totpPending: null, totpEnabledAt: new Date().toISOString(), totpLastStep: step, backupCodes: codes.map((c) => hashPassword(normBackupCode(c))) });
    this.tries.delete(user.id);
    const deviceToken = remember ? this.rememberDevice(user, deviceLabel) : null;
    await this.users.save(user);
    return { ...(await this.issueSession(user)), backupCodes: codes, deviceToken };
  }

  /** Signing in: a code from the app, or one of the backup codes (each works once). */
  async twoFactorVerify(ticket: string, input: { code?: string; backupCode?: string; remember?: boolean; deviceLabel?: string }) {
    const user = await this.fromTicket(ticket);
    if (!user.totpEnabledAt) throw new BadRequestException('Set up two-step sign-in first.');
    if (input.backupCode) {
      const want = normBackupCode(input.backupCode);
      const i = (user.backupCodes || []).findIndex((h) => verifyPassword(want, h));
      if (i < 0) this.failed(user, 'That backup code isn’t right, or was already used.');
      user.backupCodes = (user.backupCodes || []).filter((_, j) => j !== i);
    } else if (this.methodOf(user) !== 'app') {
      // A texted / emailed code: the newest, within 10 minutes, once.
      if (!otpValid(user, String(input.code || ''))) this.failed(user, 'That code isn’t right, or has run out. Ask for a new one.');
      Object.assign(user, { otpHash: null, otpExpiresAt: null });
    } else {
      const secret = user.totpSecret ? openSecret(user.totpSecret, await this.settings.jwtSecret()) : null;
      const step = secret ? checkTotp(secret, String(input.code || ''), Date.now(), user.totpLastStep) : null;
      if (step == null) this.failed(user);
      user.totpLastStep = step;
    }
    this.tries.delete(user.id);
    const deviceToken = input.remember ? this.rememberDevice(user, input.deviceLabel) : null;
    await this.users.save(user);
    return { ...(await this.issueSession(user)), deviceToken, backupCodesLeft: (user.backupCodes || []).length };
  }

  private rememberDevice(user: UserEntity, label?: string) {
    const token = randomToken();
    const now = Date.now();
    const keep = (user.trustedDevices || []).filter((d) => Date.parse(d.expiresAt) > now).slice(-9);
    user.trustedDevices = [...keep, { hash: hashToken(token), addedAt: new Date(now).toISOString(), expiresAt: new Date(now + DEVICE_DAYS * 86_400_000).toISOString(), label: String(label || '').slice(0, 80) || undefined }];
    return token;
  }

  private async me2fa(bearer: string | undefined) {
    const claims = await this.verifyReal(bearer);
    const user = claims ? await this.users.findOneBy({ id: claims.sub }) : null;
    if (!user) throw new UnauthorizedException('Sign in first.');
    return user;
  }

  /** A current code for a signed-in user: from the app, or the one just texted / emailed. */
  private async checkCurrent(user: UserEntity, code: string) {
    if (this.methodOf(user) !== 'app') {
      if (!otpValid(user, code)) throw new UnauthorizedException('That code isn’t right, or has run out.');
      Object.assign(user, { otpHash: null, otpExpiresAt: null });
      return;
    }
    const step = user.totpSecret ? checkTotp(openSecret(user.totpSecret, await this.settings.jwtSecret()) || '', code, Date.now(), user.totpLastStep) : null;
    if (step == null) throw new UnauthorizedException('That code isn’t right.');
    user.totpLastStep = step;
  }

  /** Signed in, text / email users: send a code to confirm a change (new backup codes, switching method). */
  async sendOwnCode(bearer: string | undefined) {
    const user = await this.me2fa(bearer);
    const m = this.methodOf(user);
    if (!user.totpEnabledAt || m === 'app') throw new BadRequestException('Use the code from your authenticator app.');
    return this.sendCode(user, m, m === 'sms' ? user.twoFactorPhone || '' : user.email);
  }

  /**
   * Switching how codes come (Settings → Two-step sign-in): step 1 sets up
   * the new way -- a new app secret, or a code sent to the new number / email.
   */
  async changeMethodStart(bearer: string | undefined, method: string, phone?: string) {
    const user = await this.me2fa(bearer);
    const m = await this.methodAllowed(method);
    if (m === 'app') {
      const secret = newTotpSecret();
      Object.assign(user, { totpPending: sealSecret(secret, await this.settings.jwtSecret()), otpPending: { method: 'app' } });
      await this.users.save(user);
      return { method: m, secret, uri: otpauthUri(secret, user.email) };
    }
    const to = m === 'sms' ? normalizeNumber(String(phone || '')) : user.email;
    if (m === 'sms' && (!to || to.length < 8)) throw new BadRequestException('Enter a mobile number for the codes.');
    user.otpPending = { method: m, phone: m === 'sms' ? to : null };
    return { method: m, ...(await this.sendCode(user, m, to)) };
  }

  /** Step 2: the first code from the new way switches to it. */
  async changeMethodConfirm(bearer: string | undefined, method: string, code: string) {
    const user = await this.me2fa(bearer);
    if (user.otpPending?.method !== method) throw new BadRequestException('Start again.');
    if (method === 'app') {
      const secret = user.totpPending ? openSecret(user.totpPending, await this.settings.jwtSecret()) : null;
      const step = secret ? checkTotp(secret, code) : null;
      if (step == null) throw new UnauthorizedException('That code isn’t right.');
      Object.assign(user, { twoFactorMethod: 'app', totpSecret: user.totpPending, totpPending: null, totpLastStep: step });
    } else {
      if (!otpValid(user, code)) throw new UnauthorizedException('That code isn’t right, or has run out.');
      Object.assign(user, { twoFactorMethod: method, twoFactorPhone: method === 'sms' ? user.otpPending.phone : user.twoFactorPhone, totpSecret: null, totpPending: null, otpHash: null, otpExpiresAt: null });
    }
    user.otpPending = null;
    if (!user.totpEnabledAt) user.totpEnabledAt = new Date().toISOString();
    await this.users.save(user);
    return publicUser(user);
  }

  /** New backup codes (the old ones stop working); needs a current code. */
  async newBackupCodes(bearer: string | undefined, code: string) {
    const user = await this.me2fa(bearer);
    if (!user.totpEnabledAt) throw new BadRequestException('Two-step sign-in isn’t set up.');
    await this.checkCurrent(user, code);
    const codes = newBackupCodes();
    Object.assign(user, { backupCodes: codes.map((c) => hashPassword(normBackupCode(c))) });
    await this.users.save(user);
    return { backupCodes: codes };
  }

  /** An administrator clears someone's two-step sign-in (lost phone): they set it up again at their next sign-in. */
  async resetTwoFactor(userId: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new BadRequestException('No such user.');
    Object.assign(user, { totpSecret: null, totpPending: null, totpEnabledAt: null, totpLastStep: null, backupCodes: null, trustedDevices: null, twoFactorMethod: null, twoFactorPhone: null, otpHash: null, otpExpiresAt: null, otpPending: null });
    await this.users.save(user);
    this.tries.delete(user.id);
    return { reset: true };
  }

  /** Sign in (or link) a user from a verified Google profile. */
  async loginWithGoogle(profile: GoogleProfile, deviceToken?: string | null) {
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
    return this.startSession(user, deviceToken);
  }

  /** Also used to log a guest access grant straight into a session -- see GuestAccessService. */
  async issueSession(user: UserEntity) {
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

  /**
   * The caller -- or, when an administrator sends X-View-As (Nov 13), the role
   * or person they're viewing as (read-only; the guard refuses changes).
   */
  async verify(bearer: string | undefined): Promise<SessionClaims | null> {
    const real = await this.verifyReal(bearer);
    if (!real || real.roleKey !== 'admin') return real;
    const va = parseViewAs(viewAsStore.getStore()?.header);
    if (!va) return real;
    return (await this.viewedAs(real, va)) || real;
  }

  /** As viewing: a person's own claims, or a role's (a stand-in id, VIEW-<role>). Null if not found. */
  async viewedAs(real: SessionClaims, va: { kind: 'role' | 'person'; id: string }): Promise<SessionClaims | null> {
    const by = { sub: real.sub, name: real.name, email: real.email, as: '' };
    if (va.kind === 'person') {
      const u = await this.users.findOneBy({ id: va.id });
      if (!u || u.id === real.sub) return null;
      return { ...real, sub: u.id, email: u.email, name: u.name, roleKey: u.roleKey, tier: u.tier, viewedBy: { ...by, as: u.name } };
    }
    const role = await this.roles.findOneBy({ key: va.id });
    if (!role) return null;
    return { ...real, sub: `VIEW-${role.key}`, email: '', name: role.name, roleKey: role.key, tier: role.tier, viewedBy: { ...by, as: role.name } };
  }

  /** The signed-in account itself, never a view-as (sessions, refresh, two-step settings). */
  async verifyReal(bearer: string | undefined): Promise<SessionClaims | null> {
    const raw = bearer?.startsWith('Bearer ') ? bearer.slice(7) : bearer;
    if (!raw) return null;
    const claims = verifyJwt(raw, await this.settings.jwtSecret());
    if (!claims) return null;
    // A guest's JWT is only as good as the grant it came from -- checked
    // fresh here rather than trusted for the token's full 12h life, so a
    // revoke actually ends an already-open session instead of only blocking
    // the next time someone opens the link.
    if (claims.sub.startsWith('GUEST-') && !(await this.guestGrantLive(claims.sub))) return null;
    return claims;
  }

  /** A guest keeps working as long as at least one of their grants is still live -- not just their most recent one. */
  private async guestGrantLive(userId: string): Promise<boolean> {
    const grants = await this.guestAccess.find({ where: { userId } });
    return grants.some((g) => !g.revokedAt && Date.now() <= Date.parse(g.expiresAt));
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

  /**
   * A fresh session for someone already signed in, so people working all day
   * aren't signed out mid-edit when the 12h token runs out. The account is read
   * again: a suspended or deleted user can't renew. Guest links never renew --
   * they last as long as their grant.
   */
  async refresh(bearer: string | undefined) {
    const claims = await this.verifyReal(bearer);
    if (!claims) throw new UnauthorizedException('Not signed in.');
    if (claims.sub.startsWith('GUEST-')) throw new UnauthorizedException('Guest links do not renew.');
    const user = await this.users.findOneBy({ id: claims.sub });
    if (!user) throw new UnauthorizedException('Not signed in.');
    return this.issueSession(user);
  }

  async me(bearer: string | undefined) {
    const claims = await this.verify(bearer);
    if (!claims) throw new UnauthorizedException('Not signed in.');
    // Viewing as a role: there's no account behind it, just the role (Nov 13).
    if (claims.viewedBy && claims.sub.startsWith('VIEW-')) {
      const role = await this.roles.findOneBy({ key: claims.roleKey });
      return { id: claims.sub, name: claims.name, email: '', tier: claims.tier, roleKey: claims.roleKey, status: 'active', roleName: role?.name || claims.roleKey, rolePermissions: effectivePermissions(role?.permissions as any, null as any), isSuperintendent: SUPER_ROLES.includes(claims.roleKey), viewedBy: claims.viewedBy };
    }
    const user = await this.users.findOneBy({ id: claims.sub });
    if (!user) throw new UnauthorizedException('Not signed in.');
    // The role's module permissions ride along so the app can show outside accounts only what they may use.
    const role = await this.roles.findOneBy({ key: user.roleKey });
    // With this person's own overrides on top (User Access & Roles -> a user -> Access).
    return { ...publicUser(user), viewedBy: claims.viewedBy || null, roleName: role?.name || user.roleKey, rolePermissions: effectivePermissions(role?.permissions as any, user.permissionOverrides as any), isSuperintendent: await this.isSuperintendent(user) };
  }

  /**
   * Update the signed-in user's own notification preferences.
   *
   * Lives here rather than on UsersController because that controller is
   * admin-only -- everyone must be able to set their own. Only the keys the
   * caller actually sent are touched, so an old client that only ever sends
   * notifyOnAssignment can't accidentally reset the newer preferences.
   */
  async setNotificationPrefs(bearer: string | undefined, prefs: {
    notifyOnAssignment?: boolean; notifyByEmail?: boolean; notifyBySms?: boolean;
    notifyOnOverdue?: boolean; notifyOnMilestone?: boolean; digestFrequency?: string;
  }) {
    const claims = await this.verify(bearer);
    if (!claims) throw new UnauthorizedException('Not signed in.');
    const user = await this.users.findOneBy({ id: claims.sub });
    if (!user) throw new UnauthorizedException('Not signed in.');
    for (const key of ['notifyOnAssignment', 'notifyByEmail', 'notifyBySms', 'notifyOnOverdue', 'notifyOnMilestone', 'digestFrequency'] as const) {
      if (prefs[key] !== undefined) (user as any)[key] = prefs[key];
    }
    await this.users.save(user);
    return publicUser(user);
  }

  /** Store the caller's own Google Calendar connection -- distinct from the
   *  one shared workspace connection GoogleService manages. */
  async connectMyCalendar(userId: string, refreshToken: string, email: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) return;
    user.calendarRefreshToken = refreshToken;
    user.calendarEmail = email;
    user.calendarConnectedAt = new Date().toISOString();
    await this.users.save(user);
  }

  async disconnectMyCalendar(userId: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) return;
    user.calendarRefreshToken = '';
    user.calendarEmail = '';
    user.calendarConnectedAt = '';
    await this.users.save(user);
  }

  async myCalendarStatus(userId: string) {
    const user = await this.users.findOneBy({ id: userId });
    return {
      connected: !!user?.calendarRefreshToken,
      email: user?.calendarEmail || '',
      connectedAt: user?.calendarConnectedAt || '',
    };
  }

  /** The bits CalendarService needs to read this person's own events. */
  async myCalendarCredentials(userId: string): Promise<{ refreshToken: string } | null> {
    const user = await this.users.findOneBy({ id: userId });
    return user?.calendarRefreshToken ? { refreshToken: user.calendarRefreshToken } : null;
  }

  /** The account with this address, as its main email or one of its others (Nov 13); the main one wins. */
  async findByEmail(email: string) {
    const e = normEmail(email);
    if (!e) return null;
    const rows = await this.users
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :email', { email: e })
      .orWhere('LOWER(u.altEmails) LIKE :like', { like: `%"${e.replace(/[%_[\]]/g, (c) => `[${c}]`)}"%` })
      .getMany();
    return rows.find((u) => normEmail(u.email) === e) || rows.find((u) => emailsOf(u).includes(e)) || null;
  }
}
