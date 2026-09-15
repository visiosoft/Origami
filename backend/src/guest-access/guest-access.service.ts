import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuestAccessEntity, UserEntity, ProjectEntity } from '../database/entities';
import { AuthService } from '../auth/auth.service';
import { SettingsService } from '../settings/settings.service';
import { PeopleService } from '../people/people.service';
import { signState, readState } from '../auth/crypto.util';

// The token's own signature stays valid far longer than any real grant --
// the grant's own `expiresAt`, checked on every resolve, is what actually
// enforces the window (and what a revoke acts on). This is only a safety net
// against a token surviving in someone's inbox indefinitely.
const TOKEN_SIGNATURE_MAX_AGE_MS = 120 * 24 * 60 * 60_000;
const MIN_DAYS = 1;
const MAX_DAYS = 90;
const DEFAULT_DAYS = 10;

export interface GuestActor { id?: string; name?: string }

/**
 * Time-limited "guest" access for an external client or consultant, in place
 * of a standing password account.
 *
 * A grant logs the person in as a real, passwordless UserEntity row (created
 * on first grant, reused after) and links them to the project in the People
 * directory -- the same directory the client dashboard and the Project
 * Program's client check already read, so a guest gets the ordinary app
 * experience for free rather than a bespoke read-only page.
 */
@Injectable()
export class GuestAccessService {
  constructor(
    @InjectRepository(GuestAccessEntity) private readonly repo: Repository<GuestAccessEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly auth: AuthService,
    private readonly settings: SettingsService,
    private readonly people: PeopleService,
  ) {}

  async list(projectId?: number) {
    const rows = projectId
      ? await this.repo.find({ where: { projectId }, order: { id: 'DESC' } })
      : await this.repo.find({ order: { id: 'DESC' } });
    const out = [];
    for (const r of rows) {
      const user = await this.users.findOneBy({ id: r.userId });
      out.push({
        id: r.id,
        name: user?.name || '',
        email: user?.email || '',
        tier: user?.tier || '',
        projectId: r.projectId,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        createdBy: r.createdBy || '',
        revokedAt: r.revokedAt || '',
        lastUsedAt: r.lastUsedAt || '',
        expired: !r.revokedAt && Date.now() > Date.parse(r.expiresAt),
        hasFullAccount: !!user?.passwordHash,
      });
    }
    return out;
  }

  /**
   * Grant access. Creates the account and person-directory link if this
   * email hasn't been granted access before; reuses both if it has, so a
   * second grant for the same person just refreshes their window.
   */
  async create(
    input: { name: string; email: string; tier: 'client' | 'consultant'; projectId: number; days?: number },
    actor?: GuestActor,
  ) {
    const name = (input.name || '').trim();
    const email = (input.email || '').trim().toLowerCase();
    if (!name) throw new BadRequestException('Name is required.');
    if (!email || !email.includes('@')) throw new BadRequestException('A valid email is required.');
    if (input.tier !== 'client' && input.tier !== 'consultant') {
      throw new BadRequestException('Tier must be client or consultant.');
    }
    const project = await this.projects.findOneBy({ id: Number(input.projectId) });
    if (!project) throw new BadRequestException('Project not found.');
    const days = Math.min(MAX_DAYS, Math.max(MIN_DAYS, Number(input.days) || DEFAULT_DAYS));

    let user = await this.auth.findByEmail(email);
    if (user) {
      if (user.tier === 'internal') {
        throw new BadRequestException(`${email} already has a full internal account and doesn't need guest access.`);
      }
    } else {
      user = this.users.create({
        id: 'GUEST-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name, email, tier: input.tier, roleKey: input.tier, status: 'active',
        createdAt: new Date().toISOString().slice(0, 10),
      } as Partial<UserEntity>);
      user = await this.users.save(user);
    }

    await this.people.linkToProject(email, name, input.tier === 'client' ? 'Client' : 'Consultant', project.name);

    const now = new Date();
    const grant = await this.repo.save(this.repo.create({
      userId: user.id,
      projectId: project.id,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + days * 86_400_000).toISOString(),
      createdBy: actor?.name || 'System',
    } as Partial<GuestAccessEntity>));

    const secret = await this.settings.jwtSecret();
    const base = (await this.settings.baseUrl()) || '';
    const token = signState({ mode: 'guest', grantId: grant.id }, secret);
    const link = `${base}/guest?token=${encodeURIComponent(token)}`;

    return { id: grant.id, name, email, tier: input.tier, projectId: project.id, projectName: project.name, expiresAt: grant.expiresAt, link };
  }

  async revoke(id: number) {
    const row = await this.repo.findOneBy({ id });
    if (!row) throw new BadRequestException('Grant not found.');
    row.revokedAt = new Date().toISOString();
    await this.repo.save(row);
    return { id, revokedAt: row.revokedAt };
  }

  /** Send (or re-send) a real password-set invite -- "frequent partner" upgrades to a standing account. */
  async promote(id: number) {
    const row = await this.repo.findOneBy({ id });
    if (!row) throw new BadRequestException('Grant not found.');
    const user = await this.users.findOneBy({ id: row.userId });
    if (!user) throw new BadRequestException('That account no longer exists.');
    return this.auth.sendInvite(user, 'invite');
  }

  /** The guest opening their emailed link: verify, then log them in as the account the grant points to. */
  async resolveToken(token: string) {
    const secret = await this.settings.jwtSecret();
    const parsed = readState(token, secret, TOKEN_SIGNATURE_MAX_AGE_MS);
    const grantId = Number(parsed?.grantId);
    if (!parsed || parsed.mode !== 'guest' || !Number.isFinite(grantId)) {
      throw new ForbiddenException('This link is not valid.');
    }
    const grant = await this.repo.findOneBy({ id: grantId });
    if (!grant) throw new ForbiddenException('This link is no longer valid.');
    if (grant.revokedAt) throw new ForbiddenException('This access link has been revoked. Ask your project contact for a new one.');
    if (Date.now() > Date.parse(grant.expiresAt)) {
      throw new ForbiddenException('This access link has expired. Ask your project contact for a new one.');
    }
    const user = await this.users.findOneBy({ id: grant.userId });
    if (!user) throw new ForbiddenException('This account no longer exists.');

    grant.lastUsedAt = new Date().toISOString();
    await this.repo.save(grant);

    return this.auth.issueSession(user);
  }
}
