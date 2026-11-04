import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CsiCodeEntity, EstimateLineEntity, EstimateScopeEntity, EstimateStatementEntity } from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { newId } from '../manpower/workforce.util';
import { SettingsService } from '../settings/settings.service';
import { NOTE_KINDS } from './estimate.calc';
import { EstimatesService } from './estimates.service';

const SEEDED_KEY = 'estimate.statements.seeded';
const now = () => new Date().toISOString();
const norm = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * The only wording in the team's sheet that is clearly meant for reuse. The
 * sheet's "Standard Verbage" column on the CSI CODE tab is shifted against
 * its codes, so it isn't imported; the library grows as people save wording.
 */
export const SEED_STATEMENTS: { code: string | null; kind: string; text: string }[] = [
  { code: null, kind: 'assumption', text: 'Any scope not included in the “Inclusions” does NOT mean it is included in the contracted scope.' },
  { code: '01', kind: 'inclusion', text: 'Construction Supervision, General Liability Insurance, Documentation, Cleaning, Administrative Requirements, Quality Controls, Progress Cleaning and Construction Progress.' },
];

/**
 * Standard statements for scope notes, per CSI code, plus "used before":
 * wording typed on earlier estimates for the same code that isn't in the
 * library yet, most used first.
 */
@Injectable()
export class EstimateStatementsService implements OnApplicationBootstrap {
  private readonly log = new Logger('EstimateStatements');
  constructor(
    @InjectRepository(EstimateStatementEntity) private readonly repo: Repository<EstimateStatementEntity>,
    @InjectRepository(EstimateScopeEntity) private readonly scopes: Repository<EstimateScopeEntity>,
    @InjectRepository(EstimateLineEntity) private readonly lines: Repository<EstimateLineEntity>,
    @InjectRepository(CsiCodeEntity) private readonly csi: Repository<CsiCodeEntity>,
    private readonly estimates: EstimatesService,
    private readonly settings?: SettingsService,
  ) {}

  async onApplicationBootstrap() {
    try {
      if (await this.settings?.get(SEEDED_KEY)) return;
      if ((await this.repo.count()) === 0) {
        const codes = await this.csi.find();
        await this.repo.save(SEED_STATEMENTS.map((s, i) => this.repo.create({
          id: newId('est-st'), csiCodeId: s.code ? codes.find((c) => c.code === s.code)?.id ?? null : null, kind: s.kind, text: s.text, sortOrder: i, active: true, createdAt: now(), createdBy: 'Origami',
        })));
        this.log.log(`Seeded ${SEED_STATEMENTS.length} standard statements`);
      }
      await this.settings?.set(SEEDED_KEY, '1');
    } catch (err) {
      this.log.error('Standard statements setup failed: ' + (err as Error).message);
    }
  }

  private async need(actor: Actor, what: 'view' | 'edit') {
    const r = await this.estimates.rights(actor);
    if (!r[what]) throw new ForbiddenException(what === 'edit' ? "Your role doesn't allow changing standard statements." : "Your role doesn't include estimates.");
  }

  /** The library: every statement, or those for one CSI code plus the ones for every scope. */
  async list(actor: Actor, csiCodeId?: string | null) {
    await this.need(actor, 'view');
    const all = await this.repo.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
    const rows = csiCodeId === undefined ? all : all.filter((s) => s.active && (s.csiCodeId == null || s.csiCodeId === csiCodeId));
    return { rights: await this.estimates.rights(actor), rows };
  }

  /** Wording used on earlier estimates' scopes with this CSI code, not yet in the library, most used first. */
  async suggestions(actor: Actor, csiCodeId: string | null, kind: string) {
    await this.need(actor, 'view');
    if (!csiCodeId) return { rows: [] };
    const scopes = await this.scopes.find({ where: { csiCodeId }, select: { id: true } });
    if (!scopes.length) return { rows: [] };
    const ids = scopes.map((s) => s.id);
    const used: EstimateLineEntity[] = [];
    for (let i = 0; i < ids.length; i += 500) {
      used.push(...await this.lines.find({ where: { scopeId: In(ids.slice(i, i + 500)), ...(kind ? { kind } : {}) }, select: { id: true, kind: true, description: true } }));
    }
    const known = new Set((await this.repo.find()).map((s) => norm(s.text)));
    const count = new Map<string, { text: string; kind: string; uses: number }>();
    for (const l of used) {
      const t = (l.description || '').trim();
      if (!t || l.kind === 'item' || known.has(norm(t))) continue;
      const k = `${l.kind}|${norm(t)}`;
      const hit = count.get(k);
      if (hit) hit.uses++; else count.set(k, { text: t, kind: l.kind, uses: 1 });
    }
    return { rows: [...count.values()].sort((a, b) => b.uses - a.uses).slice(0, 30) };
  }

  private clean(dto: any) {
    const kind = String(dto?.kind || '');
    if (!(NOTE_KINDS as readonly string[]).includes(kind)) throw new BadRequestException('Choose Details, Inclusions, Exclusions or Assumptions & Clarifications.');
    const text = String(dto?.text || '').trim();
    if (!text) throw new BadRequestException('The statement is empty.');
    if (text.length > 10000) throw new BadRequestException('The statement is too long.');
    const csiCodeId = dto?.csiCodeId ? String(dto.csiCodeId).slice(0, 60) : null;
    return { kind, text, csiCodeId };
  }

  async create(dto: any, actor: Actor) {
    await this.need(actor, 'edit');
    const c = this.clean(dto);
    const dup = (await this.repo.find({ where: { kind: c.kind } })).find((s) => (s.csiCodeId ?? null) === c.csiCodeId && norm(s.text) === norm(c.text));
    if (dup) return dup;
    const n = await this.repo.count();
    return this.repo.save(this.repo.create({ id: newId('est-st'), ...c, sortOrder: n, active: true, createdAt: now(), createdBy: actor.name }));
  }

  async update(id: string, dto: any, actor: Actor) {
    await this.need(actor, 'edit');
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Statement not found.');
    const c = this.clean({ kind: s.kind, csiCodeId: s.csiCodeId, text: s.text, ...dto });
    Object.assign(s, c, { active: dto?.active === undefined ? s.active : !!dto.active, updatedAt: now(), updatedBy: actor.name });
    return this.repo.save(s);
  }

  async remove(id: string, actor: Actor) {
    await this.need(actor, 'edit');
    await this.repo.delete({ id });
    return { ok: true };
  }
}
