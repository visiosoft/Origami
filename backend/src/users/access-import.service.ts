import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { AppSettingEntity, RoleEntity, UserEntity } from '../database/entities';
import { MODULE_KEYS } from '../seed-data/users';
import { ACCESS_MATRIX } from '../seed-data/access-matrix';
import { AuthService } from '../auth/auth.service';
import { LEVELS, parseAccessMatrix, rolePermissionsFrom, type MatrixParse, type Override } from './access-levels';

/** Marks the one-time apply of the built-in PEOPLE ACCESS sheet. */
export const ACCESS_MATRIX_KEY = 'roles.accessMatrix.v1';

export interface ImportOptions {
  dryRun?: boolean;
  /** sheet role key -> an existing role's key, 'new' (create it), or 'skip'. */
  mapping?: Record<string, string>;
  /** Email new users their "set your password" link. */
  invite?: boolean;
  /** Give users already here the role the sheet names (an administrator always stays one). */
  updateExisting?: boolean;
}

/**
 * The PEOPLE ACCESS sheet is the app's default access: on first start its roles
 * become roles (each data type's level and extent), and the accounts it names
 * are created (no email -- send invites from User Access & Roles) or moved to
 * their role. After that, roles are edited in the app; it never re-applies.
 */
@Injectable()
export class AccessImportService implements OnApplicationBootstrap {
  private readonly log = new Logger('AccessImport');
  constructor(
    @InjectRepository(RoleEntity) private readonly roles: Repository<RoleEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly auth: AuthService,
    @InjectRepository(AppSettingEntity) private readonly settings?: Repository<AppSettingEntity>,
  ) {}

  async onApplicationBootstrap() {
    try { await this.applyDefault(); }
    catch (err) { this.log.error('Default access sheet failed: ' + (err as Error).message); }
  }

  /** Once per install: the built-in sheet's roles and accounts. */
  async applyDefault() {
    if (!this.settings || (await this.settings.findOneBy({ key: ACCESS_MATRIX_KEY }))) return null;
    const r = await this.applyParsed(ACCESS_MATRIX as MatrixParse, { dryRun: false, invite: false, updateExisting: true });
    await this.settings.save({ key: ACCESS_MATRIX_KEY, value: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return r;
  }

  async importMatrix(rows: string[][], opts: ImportOptions) {
    let parsed;
    try { parsed = parseAccessMatrix(Array.isArray(rows) ? rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : [])) : []); }
    catch (e) { throw new BadRequestException((e as Error).message); }
    return this.applyParsed(parsed, opts);
  }

  private async applyParsed(parsed: MatrixParse, opts: ImportOptions) {
    const existingRoles = await this.roles.find();
    const existingUsers = await this.users.find();
    const byEmail = new Map(existingUsers.map((u) => [String(u.email || '').trim().toLowerCase(), u]));
    // The top internal rank becomes the built-in Administrator role unless told otherwise.
    const defaultTarget = (key: string, rank: string) => (existingRoles.some((r) => r.key === key) ? key : /^I\s*-\s*1$/i.test(rank) && /executive/.test(key) ? 'admin' : 'new');

    const roles = parsed.roles.map((r, i) => {
      const target = opts.mapping?.[r.key] || defaultTarget(r.key, r.rank);
      const existing = target !== 'new' && target !== 'skip' ? existingRoles.find((x) => x.key === target) : existingRoles.find((x) => x.key === r.key);
      return {
        sheetKey: r.key, name: r.name, tier: r.tier, rank: r.rank, classification: r.classification, emails: r.emails,
        overall: r.overall, extent: r.overall?.extent || null, dataTypes: Object.keys(r.perms).length,
        target, targetName: target === 'new' ? r.name : target === 'skip' ? '' : existing?.name || target,
        action: target === 'skip' ? 'skip' : target === 'admin' ? 'keep_admin' : existing ? 'update' : 'create',
        order: 100 + i, description: r.description, role: r,
      };
    });

    // Accounts: each email once, with the first role that names it.
    const seen = new Map<string, string>();
    const users: { email: string; roleSheetKey: string; roleName: string; action: 'create' | 'update' | 'keep' | 'skip'; current?: string; alsoIn: string[]; note?: string }[] = [];
    for (const r of roles) {
      for (const email of r.emails) {
        if (seen.has(email)) { users.find((u) => u.email === email)!.alsoIn.push(r.name); continue; }
        seen.set(email, r.sheetKey);
        const u = byEmail.get(email);
        const roleKey = r.target === 'new' ? r.sheetKey : r.target;
        const action = r.target === 'skip' ? 'skip' : !u ? 'create' : u.roleKey === 'admin' ? 'keep' : opts.updateExisting === false || u.roleKey === roleKey ? 'keep' : 'update';
        users.push({ email, roleSheetKey: r.sheetKey, roleName: r.targetName, action, current: u?.roleKey, alsoIn: [], note: u?.roleKey === 'admin' ? 'stays an Administrator' : undefined });
      }
    }

    const summary = {
      roles: roles.map(({ role: _r, description: _d, order: _o, ...rest }) => rest),
      users, unmatched: parsed.unmatched, dataTypes: parsed.dataTypes,
    };
    if (opts.dryRun !== false) return { ...summary, applied: false };

    // ---- apply
    for (const r of roles) {
      if (r.action === 'skip' || r.action === 'keep_admin') continue;
      const key = r.target === 'new' ? r.sheetKey : r.target;
      const prev = existingRoles.find((x) => x.key === key);
      await this.roles.save(this.roles.create({
        ...(prev || {}), key, name: prev?.name || r.name, description: r.description, tier: r.tier,
        order: prev?.order ?? r.order, isSystem: prev?.isSystem ?? false, permissions: rolePermissionsFrom(r.role, MODULE_KEYS) as any,
      }));
    }
    const results: { email: string; result: string }[] = [];
    for (const u of users) {
      const r = roles.find((x) => x.sheetKey === u.roleSheetKey)!;
      const roleKey = r.target === 'new' ? r.sheetKey : r.target;
      const tier = r.target === 'admin' ? 'internal' : r.tier;
      if (u.action === 'create') {
        const name = u.email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const saved = await this.users.save(this.users.create({ id: 'U-' + randomUUID().slice(0, 8), name, email: u.email, roleKey, tier, status: 'pending', createdAt: new Date().toISOString().slice(0, 10) } as Partial<UserEntity>));
        let result = 'created';
        if (opts.invite !== false) {
          try { const inv = await this.auth.sendInvite(saved, 'invite'); result = inv.sent ? 'created · invited' : 'created · invite not sent'; }
          catch (e) { result = 'created · invite failed: ' + (e as Error).message; }
        }
        results.push({ email: u.email, result });
      } else if (u.action === 'update') {
        const prev = byEmail.get(u.email)!;
        await this.users.update({ id: prev.id }, { roleKey, tier } as Partial<UserEntity>);
        results.push({ email: u.email, result: `role ${prev.roleKey} → ${roleKey}` });
      }
    }
    this.log.log(`Access matrix imported: ${roles.filter((r) => r.action === 'create' || r.action === 'update').length} roles, ${results.length} accounts`);
    return { ...summary, applied: true, results };
  }

  // ------------------------------------------------------------ a person's own access

  async overrides(userId: string) {
    const u = await this.users.findOneBy({ id: userId });
    if (!u) throw new NotFoundException('User not found.');
    const role = await this.roles.findOneBy({ key: u.roleKey });
    return { userId, roleKey: u.roleKey, roleName: role?.name || u.roleKey, rolePermissions: role?.permissions || {}, overrides: u.permissionOverrides || {} };
  }

  /** Set a person's overrides: only real levels / extents; empty entries are dropped (back to the role default). */
  async setOverrides(userId: string, raw: unknown) {
    const u = await this.users.findOneBy({ id: userId });
    if (!u) throw new NotFoundException('User not found.');
    const out: Record<string, Override> = {};
    for (const [k, v] of Object.entries((raw && typeof raw === 'object' ? raw : {}) as Record<string, any>)) {
      if (!/^[\w:.\-]{1,120}$/.test(k)) continue;
      const level = (LEVELS as readonly string[]).includes(v?.level) ? v.level : undefined;
      const extent = v?.extent === 'assigned' || v?.extent === 'portfolio' ? v.extent : undefined;
      if (level || extent) out[k] = { ...(level ? { level } : {}), ...(extent ? { extent } : {}) };
    }
    await this.users.update({ id: userId }, { permissionOverrides: Object.keys(out).length ? out : null } as any);
    return this.overrides(userId);
  }
}

