import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository, type EntityManager } from 'typeorm';
import {
  EstimateEntity, EstimateGrLineEntity, EstimateLineEntity, EstimateScopeEntity, ProjectEntity,
  type EstimateColumn, type EstimatePayment,
} from '../database/entities';
import { ManpowerAccess, type Actor } from '../manpower/manpower-access.service';
import { newId, todayISO } from '../manpower/workforce.util';
import { FinancialsService, FIN_MODULE } from './financials.service';
import { computeEstimate, FORMULAS, isPricing, NOTE_KINDS, STRATEGIES, type EstimateResult } from './estimate.calc';
import { fromCents, toCents } from './money';

export const ESTIMATING_MODULE = 'estimating';
export const PRECON_KEY = 'fin:preconstruction_estimates';

/** The General Requirements lines a new estimate starts with (the team's sheet, 2.01-2.14). */
export const DEFAULT_GR: { title: string; unit: string; qty: number }[] = [
  { title: 'Construction Supervision', unit: 'Monthly', qty: 1 },
  { title: 'General Liability', unit: 'LS', qty: 1 },
  { title: 'Documentation', unit: 'LS', qty: 1 },
  { title: 'Progress Cleaning', unit: 'LS', qty: 1 },
  { title: 'Final Cleaning', unit: 'LS', qty: 1 },
  { title: 'Administrative', unit: 'LS', qty: 1 },
  { title: 'Quality Controls', unit: 'LS', qty: 1 },
  { title: 'Equipment Rental', unit: 'LS', qty: 1 },
  { title: 'Progress Requirements', unit: 'LS', qty: 1 },
  { title: 'Temporary Facilities', unit: 'LS', qty: 1 },
  { title: 'Temporary Services', unit: 'LS', qty: 1 },
  { title: 'Other Cost', unit: 'LS', qty: 1 },
  { title: 'Temporary Structures', unit: 'LS', qty: 1 },
  { title: 'Utility Usage', unit: 'LS', qty: 1 },
];

const COLUMN_TYPES = ['text', 'number', 'money', 'pct', 'date', 'choice', 'checkbox', 'formula'];
const LINE_KINDS = ['item', ...NOTE_KINDS];
const LOCKED = ['sent', 'accepted', 'superseded'];
const now = () => new Date().toISOString();

const str = (v: unknown, max: number): string | null => {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v);
  if (s.length > max) throw new BadRequestException(`Text is too long (over ${max} characters).`);
  return s;
};
const amount = (v: unknown, name: string, allowNegative = false): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > 1e12 || (!allowNegative && n < 0)) throw new BadRequestException(`${name} must be ${allowNegative ? 'an' : 'a positive'} amount.`);
  return fromCents(toCents(n));
};
const optAmount = (v: unknown, name: string) => (v === null || v === undefined || v === '' ? null : amount(v, name));
const pct = (v: unknown, name: string, max = 100): number => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n < -max || n > max * 100) throw new BadRequestException(`${name} is not a valid percentage.`);
  return Math.round(n * 10000) / 10000;
};
const custom = (v: unknown): Record<string, unknown> | null => {
  if (v == null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) throw new BadRequestException('Custom cells must be an object.');
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (!/^[a-z0-9_]{1,40}$/i.test(k)) continue;
    if (x === null || typeof x === 'number' || typeof x === 'boolean') out[k] = x;
    else out[k] = String(x).slice(0, 2000);
  }
  return Object.keys(out).length ? out : null;
};

export function cleanColumns(v: unknown): EstimateColumn[] {
  if (!Array.isArray(v)) return [];
  if (v.length > 60) throw new BadRequestException('An estimate can have up to 60 columns.');
  const seen = new Set<string>();
  return v.map((c: any) => {
    const key = String(c?.key || '');
    if (!/^[a-z0-9_]{1,40}$/i.test(key) || seen.has(key)) throw new BadRequestException('Each column needs a unique key.');
    seen.add(key);
    const type = String(c?.type || 'text');
    if (!COLUMN_TYPES.includes(type)) throw new BadRequestException(`Unknown column type "${type}".`);
    const col: EstimateColumn = {
      key, type, label: str(c?.label, 80) || key, table: c?.table === 'gr' ? 'gr' : 'lines',
      hidden: !!c?.hidden, showClient: !!c?.showClient, showSub: !!c?.showSub, builtIn: !!c?.builtIn,
    };
    if (type === 'formula') col.formula = str(c?.formula, 500) || '';
    if (type === 'choice') col.choices = (Array.isArray(c?.choices) ? c.choices : []).slice(0, 50).map((x: unknown) => String(x).slice(0, 80));
    if (Number.isFinite(Number(c?.width)) && c?.width) col.width = Math.max(40, Math.min(800, Math.round(Number(c.width))));
    return col;
  });
}

function cleanPayments(v: unknown): EstimatePayment[] {
  if (!Array.isArray(v)) return [];
  if (v.length > 50) throw new BadRequestException('Up to 50 payment rows.');
  return v.map((p: any, i) => {
    const mode = p?.mode === 'amt' ? 'amt' : 'pct';
    return {
      id: str(p?.id, 60) || `p${i + 1}`, label: str(p?.label, 200) || `Payment ${i + 1}`, mode,
      value: mode === 'amt' ? amount(p?.value, 'Payment') : pct(p?.value, 'Payment %'), trigger: str(p?.trigger, 200) || undefined,
    };
  });
}

export interface EstimateSheet { scopes: EstimateScopeEntity[]; lines: EstimateLineEntity[]; gr: EstimateGrLineEntity[] }

/** Feed the stored rows to the maths. */
export function resultOf(e: EstimateEntity, sheet: EstimateSheet): EstimateResult {
  return computeEstimate({
    settings: { grPct: e.grPct, profitPct: e.profitPct, contingencyPct: e.contingencyPct, discount: e.discount, designCost: e.designCost },
    scopes: sheet.scopes.map((s) => ({ id: s.id, factor: s.factor })),
    lines: sheet.lines.map((l) => ({ id: l.id, scopeId: l.scopeId, kind: l.kind, pricing: l.pricing, cost: l.cost, markupMode: l.markupMode, markupAmt: l.markupAmt, markupPct: l.markupPct })),
    gr: sheet.gr.map((g) => ({ id: g.id, included: g.included, base: g.base, qty: g.qty })),
    payments: (e.payments || []).map((p) => ({ id: p.id, mode: p.mode, value: p.value })),
  });
}

/**
 * Estimates (financial tab): the prime contract built like the team's sheet.
 * The grid saves the whole sheet at once (scopes, lines, GR lines), checked
 * against the version it opened; a sent estimate is frozen and edited only by
 * making a new revision.
 */
@Injectable()
export class EstimatesService {
  constructor(
    @InjectRepository(EstimateEntity) private readonly estimates: Repository<EstimateEntity>,
    @InjectRepository(EstimateScopeEntity) private readonly scopes: Repository<EstimateScopeEntity>,
    @InjectRepository(EstimateLineEntity) private readonly lines: Repository<EstimateLineEntity>,
    @InjectRepository(EstimateGrLineEntity) private readonly grLines: Repository<EstimateGrLineEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly fin: FinancialsService,
    private readonly access: ManpowerAccess,
    private readonly db: DataSource,
  ) {}

  /** Estimating -> view/manage, Preconstruction Estimates, or Project Financials. */
  async rights(actor: Actor) {
    const perms = await this.access.permissionsOf(actor);
    const has = (k: string, a: 'view' | 'manage') => perms === 'all' || !!perms?.[k]?.[a];
    const edit = [ESTIMATING_MODULE, PRECON_KEY, FIN_MODULE].some((k) => has(k, 'manage'));
    const view = edit || [ESTIMATING_MODULE, PRECON_KEY, FIN_MODULE].some((k) => has(k, 'view'));
    return { view, edit };
  }
  private async need(actor: Actor, what: 'view' | 'edit') {
    const r = await this.rights(actor);
    if (!r[what]) throw new ForbiddenException(what === 'edit' ? "Your role doesn't allow editing estimates." : "Your role doesn't include estimates.");
  }

  private async project(projectId: number) {
    const p = await this.projects.findOne({ where: { id: projectId } });
    if (!p) throw new NotFoundException('Project not found.');
    return p;
  }
  private async one(projectId: number, id: string) {
    const e = await this.estimates.findOne({ where: { id } });
    if (!e || e.projectId !== projectId) throw new NotFoundException('Estimate not found.');
    return e;
  }
  private async sheetOf(estimateId: string): Promise<EstimateSheet> {
    const [scopes, lines, gr] = await Promise.all([
      this.scopes.find({ where: { estimateId }, order: { scopeOrder: 'ASC' } }),
      this.lines.find({ where: { estimateId }, order: { lineOrder: 'ASC' } }),
      this.grLines.find({ where: { estimateId }, order: { lineOrder: 'ASC' } }),
    ]);
    return { scopes, lines, gr };
  }

  private async nextNumber(projectId: number) {
    const numbers = (await this.estimates.find({ where: { projectId, isTemplate: false }, select: { number: true } })).map((e) => Number(String(e.number).replace(/\D/g, '')) || 0);
    return `EST-${String(Math.max(0, ...numbers) + 1).padStart(3, '0')}`;
  }

  /** An estimate or template the caller may read (for copying from). */
  private async source(id: string, canSee: (projectId: number) => boolean) {
    const e = await this.estimates.findOne({ where: { id } });
    if (!e || (!e.isTemplate && !canSee(e.projectId))) throw new NotFoundException('That estimate or template was not found.');
    return e;
  }

  /** Copy rows into an estimate with new ids; scopes go after the ones it has. */
  private async cloneRows(m: EntityManager, sheet: EstimateSheet, target: { id: string; projectId: number }, startOrder = 0, withGr = true) {
    const scopeMap = new Map(sheet.scopes.map((s) => [s.id, newId('esc')]));
    if (sheet.scopes.length) await m.save(sheet.scopes.map((s, i) => this.scopes.create({ ...s, id: scopeMap.get(s.id)!, estimateId: target.id, projectId: target.projectId, scopeOrder: startOrder + i })));
    const lines = sheet.lines.filter((l) => scopeMap.has(l.scopeId));
    for (let i = 0; i < lines.length; i += 200) await m.save(lines.slice(i, i + 200).map((l) => this.lines.create({ ...l, id: newId('eln'), estimateId: target.id, projectId: target.projectId, scopeId: scopeMap.get(l.scopeId)! })));
    if (withGr && sheet.gr.length) await m.save(sheet.gr.map((g) => this.grLines.create({ ...g, id: newId('egr'), estimateId: target.id, projectId: target.projectId })));
  }

  /** The estimate's settings, without its identity and history. */
  private settingsOf(src: EstimateEntity) {
    const { id: _i, version: _v, status: _s, sentAt: _sa, frozenAt: _f, acceptedAt: _a, acceptedBy: _ab, revisionOf: _r, projectId: _p, number: _n, rev: _rv, isTemplate: _t, createdAt: _c, createdBy: _cb, updatedAt: _u, updatedBy: _ub, ...rest } = src;
    void _i; void _v; void _s; void _sa; void _f; void _a; void _ab; void _r; void _p; void _n; void _rv; void _t; void _c; void _cb; void _u; void _ub;
    return rest;
  }

  private async copyNew(projectId: number, fromId: string, title: string | null, actor: Actor, canSee: (projectId: number) => boolean, projectName?: string) {
    const src = await this.source(fromId, canSee);
    const sheet = await this.sheetOf(src.id);
    const e = this.estimates.create({
      ...this.settingsOf(src), id: newId('est'), projectId, number: await this.nextNumber(projectId), rev: 1, isTemplate: false, status: 'draft', revisionOf: null,
      title: title || (src.isTemplate ? `${projectName || 'Estimate'} — ${src.title || 'from template'}` : src.title), estimateDate: todayISO(), preparedById: actor.id || null,
      sentAt: null, frozenAt: null, acceptedAt: null, acceptedBy: null, createdAt: now(), createdBy: actor.name, updatedAt: now(), updatedBy: actor.name,
    });
    await this.db.transaction(async (m) => {
      await m.save(e);
      await this.cloneRows(m, sheet, e);
      await this.fin.log(m, { projectId, entityType: 'estimate', entityId: e.id, action: 'created', reason: `${e.number} from ${src.isTemplate ? `template “${src.title}”` : `${src.number} Rev ${src.rev}`}` }, actor);
    });
    return this.get(projectId, e.id, actor);
  }

  // ------------------------------------------------------------------ templates (projectId 0)
  async templates(actor: Actor) {
    await this.need(actor, 'view');
    const rows = await this.estimates.find({ where: { isTemplate: true }, order: { title: 'ASC' } });
    const out = [];
    for (const t of rows) {
      const sheet = await this.sheetOf(t.id);
      out.push({ id: t.id, title: t.title, updatedAt: t.updatedAt, updatedBy: t.updatedBy, scopes: sheet.scopes.length, lines: sheet.lines.filter((l) => l.kind === 'item').length, totalProject: fromCents(resultOf(t, sheet).totals.totalProject) });
    }
    return { rights: await this.rights(actor), rows: out };
  }

  /** A blank template, or "Save as template" from an estimate (an exact copy). */
  async createTemplate(dto: any, actor: Actor, canSee: (projectId: number) => boolean) {
    await this.need(actor, 'edit');
    const title = str(dto?.title, 200);
    if (!title) throw new BadRequestException('Give the template a name.');
    const src = dto?.fromId ? await this.source(String(dto.fromId), canSee) : null;
    const t = this.estimates.create({
      ...(src ? this.settingsOf(src) : { grPct: 17, profitPct: 12, contingencyPct: 5, showGrDetail: true, showDiscount: false, showDesignCost: false, discount: null, designCost: null, columns: [], payments: [], areas: null }),
      id: newId('est'), projectId: 0, number: 'TPL', rev: 1, isTemplate: true, status: 'draft', title, revisionOf: null, estimateDate: null,
      sentAt: null, frozenAt: null, acceptedAt: null, acceptedBy: null, createdAt: now(), createdBy: actor.name, updatedAt: now(), updatedBy: actor.name,
    });
    await this.db.transaction(async (m) => {
      await m.save(t);
      if (src) await this.cloneRows(m, await this.sheetOf(src.id), t);
      else await m.save(DEFAULT_GR.map((g, i) => this.grLines.create({ id: newId('egr'), estimateId: t.id, projectId: 0, lineOrder: i, title: g.title, unit: g.unit, qty: g.qty, base: 0, included: true })));
    });
    return this.get(0, t.id, actor);
  }

  /** Every estimate the caller can see, across projects (to start from one). Narrowed to their projects by ProjectScope. */
  async allEstimates(actor: Actor) {
    await this.need(actor, 'view');
    const rows = await this.estimates.find({ where: { isTemplate: false }, order: { updatedAt: 'DESC' } });
    const names = new Map((await this.projects.find({ select: { id: true, name: true } })).map((p) => [p.id, p.name]));
    return { rows: rows.map((e) => ({ id: e.id, projectId: e.projectId, projectName: names.get(e.projectId) || `Project ${e.projectId}`, number: e.number, rev: e.rev, title: e.title, status: e.status, updatedAt: e.updatedAt })) };
  }

  /** Read a template or an estimate to pick scopes from. */
  async sourceSheet(id: string, actor: Actor, canSee: (projectId: number) => boolean) {
    await this.need(actor, 'view');
    const e = await this.source(id, canSee);
    const sheet = await this.sheetOf(id);
    const r = resultOf(e, sheet);
    const totals = new Map(r.scopes.map((s) => [s.id, s.total]));
    return {
      id: e.id, title: e.title, isTemplate: e.isTemplate, number: e.number, rev: e.rev,
      scopes: sheet.scopes.map((s) => ({ id: s.id, title: s.title, csiCodeId: s.csiCodeId, lines: sheet.lines.filter((l) => l.scopeId === s.id).length, total: fromCents(totals.get(s.id) || 0) })),
    };
  }

  /** "+ Scope from…": copy chosen scopes (lines and notes included) onto the end of this estimate. */
  async copyScopes(projectId: number, id: string, dto: any, actor: Actor, canSee: (projectId: number) => boolean) {
    await this.need(actor, 'edit');
    const e = await this.one(projectId, id);
    this.editable(e);
    this.checkVersion(e, dto?.version);
    const src = await this.source(String(dto?.fromId || ''), canSee);
    const pick = new Set((Array.isArray(dto?.scopeIds) ? dto.scopeIds : []).map(String));
    const all = await this.sheetOf(src.id);
    const scopes = all.scopes.filter((s) => pick.has(s.id));
    if (!scopes.length) throw new BadRequestException('Pick at least one scope to copy.');
    const existing = await this.scopes.count({ where: { estimateId: id } });
    await this.db.transaction(async (m) => {
      await this.cloneRows(m, { scopes, lines: all.lines, gr: [] }, e, existing, false);
      e.updatedAt = now(); e.updatedBy = actor.name;
      await m.save(e);
    });
    return this.get(projectId, id, actor);
  }

  async list(projectId: number, actor: Actor) {
    await this.need(actor, 'view');
    await this.project(projectId);
    const rows = await this.estimates.find({ where: { projectId, isTemplate: false }, order: { number: 'ASC', rev: 'DESC' } });
    const out = [];
    for (const e of rows) {
      const t = resultOf(e, await this.sheetOf(e.id)).totals;
      out.push({ id: e.id, number: e.number, rev: e.rev, title: e.title, status: e.status, estimateDate: e.estimateDate, sentAt: e.sentAt, acceptedAt: e.acceptedAt, updatedAt: e.updatedAt, totalProject: fromCents(t.totalProject), totalBuild: fromCents(t.totalBuild) });
    }
    return { rights: await this.rights(actor), rows: out };
  }

  async get(projectId: number, id: string, actor: Actor) {
    await this.need(actor, 'view');
    const e = await this.one(projectId, id);
    const sheet = await this.sheetOf(id);
    return { estimate: e, ...sheet, result: resultOf(e, sheet), formulas: FORMULAS, rights: await this.rights(actor), locked: LOCKED.includes(e.status) };
  }

  /**
   * A new estimate: blank (the standard GR lines), or an exact copy of a
   * template or of another estimate (`fromId`; `canSee` says whether the
   * caller may read that estimate's project).
   */
  async create(projectId: number, dto: any, actor: Actor, canSee: (projectId: number) => boolean = () => true) {
    await this.need(actor, 'edit');
    const p = await this.project(projectId);
    if (dto?.fromId) return this.copyNew(projectId, String(dto.fromId), str(dto?.title, 200), actor, canSee, p.name);
    const number = await this.nextNumber(projectId);
    const e = this.estimates.create({
      id: newId('est'), projectId, number, rev: 1, title: str(dto?.title, 200) || p.name || 'Estimate', status: 'draft',
      estimateDate: todayISO(), preparedById: actor.id || null, columns: [], payments: [], areas: null,
      isTemplate: false, grPct: 17, profitPct: 12, contingencyPct: 5, showGrDetail: true, showDiscount: false, showDesignCost: false, discount: null, designCost: null,
      createdAt: now(), createdBy: actor.name, updatedAt: now(), updatedBy: actor.name,
    });
    await this.db.transaction(async (m) => {
      await m.save(e);
      await m.save(DEFAULT_GR.map((g, i) => this.grLines.create({ id: newId('egr'), estimateId: e.id, projectId, lineOrder: i, title: g.title, unit: g.unit, qty: g.qty, base: 0, included: true })));
      await this.fin.log(m, { projectId, entityType: 'estimate', entityId: e.id, action: 'created', reason: number }, actor);
    });
    return this.get(projectId, e.id, actor);
  }

  private editable(e: EstimateEntity) {
    if (LOCKED.includes(e.status)) throw new ConflictException(`${e.number} Rev ${e.rev} was ${e.status} and is frozen -- make a new revision to change it.`);
  }
  private checkVersion(e: EstimateEntity, version: unknown) {
    if (version == null || Number(version) !== Number(e.version)) throw new ConflictException(`This estimate was changed${e.updatedBy ? ` by ${e.updatedBy}` : ''} since you opened it -- reload and try again.`);
  }

  /** Header, percentages, letter text, columns, payments, areas. */
  async saveSettings(projectId: number, id: string, dto: any, actor: Actor) {
    await this.need(actor, 'edit');
    const e = await this.one(projectId, id);
    this.editable(e);
    this.checkVersion(e, dto?.version);
    const has = (k: string) => dto && Object.prototype.hasOwnProperty.call(dto, k);
    if (has('title')) e.title = str(dto.title, 200);
    for (const k of ['grPct', 'profitPct', 'contingencyPct'] as const) if (has(k)) e[k] = pct(dto[k], k === 'grPct' ? 'GR %' : k === 'profitPct' ? 'Profit %' : 'Contingency %');
    if (has('discount')) e.discount = optAmount(dto.discount, 'Discount');
    if (has('designCost')) e.designCost = optAmount(dto.designCost, 'Design cost');
    for (const k of ['showGrDetail', 'showDiscount', 'showDesignCost'] as const) if (has(k)) e[k] = !!dto[k];
    if (has('estimateDate')) e.estimateDate = str(dto.estimateDate, 20);
    if (has('preparedById')) e.preparedById = str(dto.preparedById, 60);
    if (has('reviewedById')) e.reviewedById = str(dto.reviewedById, 60);
    for (const k of ['intro', 'descriptionOfWork', 'terms', 'closing', 'additionalNotes'] as const) if (has(k)) e[k] = str(dto[k], 50000);
    if (has('columns')) e.columns = cleanColumns(dto.columns);
    if (has('payments')) e.payments = cleanPayments(dto.payments);
    if (has('areas')) {
      const a = dto.areas || {};
      e.areas = Object.fromEntries(['demolish', 'footprint', 'built', 'conditioned', 'roof', 'hardscape', 'landscape'].filter((k) => a[k] != null && a[k] !== '').map((k) => [k, Math.max(0, Number(a[k]) || 0)]));
    }
    e.updatedAt = now(); e.updatedBy = actor.name;
    await this.estimates.save(e);
    return this.get(projectId, id, actor);
  }

  /**
   * The grid's save: the whole sheet as it stands. Rows not sent are deleted;
   * order is the order sent. All or nothing, and only on the version opened.
   */
  async saveSheet(projectId: number, id: string, dto: any, actor: Actor) {
    await this.need(actor, 'edit');
    const e = await this.one(projectId, id);
    this.editable(e);
    this.checkVersion(e, dto?.version);
    const sIn: any[] = Array.isArray(dto?.scopes) ? dto.scopes : [];
    const lIn: any[] = Array.isArray(dto?.lines) ? dto.lines : [];
    const gIn: any[] = Array.isArray(dto?.gr) ? dto.gr : [];
    if (sIn.length > 300 || lIn.length > 5000 || gIn.length > 300) throw new BadRequestException('The estimate is too large to save at once.');
    const ids = new Set<string>();
    const idOf = (v: unknown, prefix: string) => {
      const raw = String(v || '');
      const out = /^[a-z0-9_-]{4,60}$/i.test(raw) ? raw : newId(prefix);
      if (ids.has(out)) throw new BadRequestException('A row appears twice.');
      ids.add(out);
      return out;
    };
    const scopes = sIn.map((s, i) => this.scopes.create({
      id: idOf(s?.id, 'esc'), estimateId: id, projectId, scopeOrder: i, csiCodeId: str(s?.csiCodeId, 60), title: str(s?.title, 300),
      factor: s?.factor == null || s.factor === '' ? null : pct(s.factor, 'Factor', 100), privateNotes: str(s?.privateNotes, 20000), collapsed: !!s?.collapsed, custom: custom(s?.custom),
    }));
    const scopeIds = new Set(scopes.map((s) => s.id));
    const lines = lIn.map((l, i) => {
      const kind = String(l?.kind || 'item');
      if (!LINE_KINDS.includes(kind)) throw new BadRequestException(`Unknown row type "${kind}".`);
      const scopeId = String(l?.scopeId || '');
      if (!scopeIds.has(scopeId)) throw new BadRequestException('Every line must belong to a scope on this estimate.');
      const pricing = String(l?.pricing || 'fc');
      if (!isPricing(pricing)) throw new BadRequestException(`Unknown pricing type "${pricing}".`);
      const subPricing = l?.subPricing ? String(l.subPricing) : null;
      if (subPricing && !isPricing(subPricing)) throw new BadRequestException(`Unknown pricing type "${subPricing}".`);
      const strategy = l?.strategy ? String(l.strategy) : null;
      if (strategy && !(STRATEGIES as readonly string[]).includes(strategy)) throw new BadRequestException(`Unknown performing strategy "${strategy}".`);
      const markupMode = l?.markupMode === 'pct' ? 'pct' : 'amt';
      const dur = l?.durationDays == null || l.durationDays === '' ? null : Math.round(Number(l.durationDays));
      if (dur != null && (!Number.isFinite(dur) || dur < 0 || dur > 100000)) throw new BadRequestException('Duration must be a number of days.');
      return this.lines.create({
        id: idOf(l?.id, 'eln'), estimateId: id, projectId, scopeId, lineOrder: i, kind, statementId: str(l?.statementId, 60),
        indent: Math.max(0, Math.min(3, Math.round(Number(l?.indent) || 0))),
        description: str(l?.description, 20000),
        costTypes: Array.isArray(l?.costTypes) ? l.costTypes.slice(0, 10).map((c: unknown) => String(c).slice(0, 60)) : null,
        pricing, subPricing, strategy, contractorId: str(l?.contractorId, 60), subName: str(l?.subName, 200), durationDays: dur, startDate: str(l?.startDate, 20),
        cost: kind === 'item' ? amount(l?.cost, 'Sub cost') : 0,
        markupMode, markupAmt: kind === 'item' && markupMode === 'amt' ? amount(l?.markupAmt, 'Markup', true) : 0,
        markupPct: kind === 'item' && markupMode === 'pct' ? pct(l?.markupPct, 'Markup %', 100) : null,
        subNotes: str(l?.subNotes, 20000), privateNotes: str(l?.privateNotes, 20000), custom: custom(l?.custom),
      });
    });
    const gr = gIn.map((g, i) => this.grLines.create({
      id: idOf(g?.id, 'egr'), estimateId: id, projectId, lineOrder: i, title: str(g?.title, 300) || 'General requirement', included: g?.included !== false,
      base: amount(g?.base, 'GR base amount'), unit: str(g?.unit, 40) || 'LS',
      qty: (() => { const q = Number(g?.qty ?? 1); if (!Number.isFinite(q) || q < 0 || q > 1e6) throw new BadRequestException('GR quantity must be a positive number.'); return Math.round(q * 10000) / 10000; })(),
      notes: str(g?.notes, 20000), custom: custom(g?.custom),
    }));

    await this.db.transaction(async (m) => {
      const old = await this.sheetOf(id);
      const drop = <T extends { id: string }>(rows: T[], keep: T[]) => rows.filter((r) => !keep.some((k) => k.id === r.id)).map((r) => r.id);
      const dl = drop(old.lines, lines), ds = drop(old.scopes, scopes), dg = drop(old.gr, gr);
      if (dl.length) await m.delete(EstimateLineEntity, { id: In(dl), estimateId: id });
      if (ds.length) await m.delete(EstimateScopeEntity, { id: In(ds), estimateId: id });
      if (dg.length) await m.delete(EstimateGrLineEntity, { id: In(dg), estimateId: id });
      // Ids must not belong to another estimate.
      const clash = async (E: any, rows: { id: string }[]) => rows.length && (await m.count(E, { where: { id: In(rows.map((r) => r.id)) } as any })) > (await m.count(E, { where: { id: In(rows.map((r) => r.id)), estimateId: id } as any }));
      if (await clash(EstimateLineEntity, lines) || await clash(EstimateScopeEntity, scopes) || await clash(EstimateGrLineEntity, gr)) throw new BadRequestException('A row belongs to another estimate.');
      for (let i = 0; i < scopes.length; i += 200) await m.save(scopes.slice(i, i + 200));
      for (let i = 0; i < lines.length; i += 200) await m.save(lines.slice(i, i + 200));
      for (let i = 0; i < gr.length; i += 200) await m.save(gr.slice(i, i + 200));
      e.updatedAt = now(); e.updatedBy = actor.name;
      await m.save(e);
    });
    return this.get(projectId, id, actor);
  }

  /** Sent to the client: frozen from now on. */
  async markSent(projectId: number, id: string, actor: Actor) {
    await this.need(actor, 'edit');
    const e = await this.one(projectId, id);
    if (e.isTemplate) throw new BadRequestException('A template isn’t sent -- start an estimate from it.');
    if (e.status !== 'draft') throw new ConflictException(`${e.number} Rev ${e.rev} is already ${e.status}.`);
    await this.db.transaction(async (m) => {
      // Older revisions of the same estimate are now out of date.
      const older = await m.find(EstimateEntity, { where: { projectId, number: e.number } });
      for (const o of older) if (o.id !== e.id && o.status === 'sent') { o.status = 'superseded'; o.updatedAt = now(); o.updatedBy = actor.name; await m.save(o); }
      e.status = 'sent'; e.sentAt = now(); e.frozenAt = e.sentAt; e.updatedAt = now(); e.updatedBy = actor.name;
      await m.save(e);
      await this.fin.log(m, { projectId, entityType: 'estimate', entityId: e.id, action: 'sent', reason: `${e.number} Rev ${e.rev}` }, actor);
    });
    return this.get(projectId, id, actor);
  }

  /** A new draft revision copied from this one (Rev n+1); the copy keeps the number. */
  async revise(projectId: number, id: string, actor: Actor) {
    await this.need(actor, 'edit');
    const src = await this.one(projectId, id);
    if (src.isTemplate) throw new BadRequestException('Templates have no revisions -- edit the template.');
    const same = await this.estimates.find({ where: { projectId, number: src.number } });
    if (same.some((x) => x.status === 'draft')) throw new ConflictException(`${src.number} already has a draft revision -- edit that one.`);
    if (same.some((x) => x.status === 'accepted')) throw new ConflictException(`${src.number} was accepted; changes now go through change orders.`);
    const sheet = await this.sheetOf(id);
    const rev = Math.max(...same.map((x) => x.rev)) + 1;
    const copy = this.estimates.create({ ...this.settingsOf(src), id: newId('est'), projectId, number: src.number, isTemplate: false, rev, status: 'draft', revisionOf: src.id, sentAt: null, frozenAt: null, acceptedAt: null, acceptedBy: null, estimateDate: todayISO(), createdAt: now(), createdBy: actor.name, updatedAt: now(), updatedBy: actor.name });
    await this.db.transaction(async (m) => {
      await m.save(copy);
      await this.cloneRows(m, sheet, copy);
      await this.fin.log(m, { projectId, entityType: 'estimate', entityId: copy.id, action: 'revised', reason: `${src.number} Rev ${rev} from Rev ${src.rev}` }, actor);
    });
    return this.get(projectId, copy.id, actor);
  }

  /** Only a draft can be deleted; sent ones are the record. */
  async remove(projectId: number, id: string, actor: Actor) {
    await this.need(actor, 'edit');
    const e = await this.one(projectId, id);
    if (e.status !== 'draft') throw new ConflictException('Only a draft can be deleted -- sent estimates are kept as the record.');
    await this.db.transaction(async (m) => {
      await m.delete(EstimateLineEntity, { estimateId: id });
      await m.delete(EstimateScopeEntity, { estimateId: id });
      await m.delete(EstimateGrLineEntity, { estimateId: id });
      await m.delete(EstimateEntity, { id });
      await this.fin.log(m, { projectId, entityType: 'estimate', entityId: id, action: 'deleted', reason: `${e.number} Rev ${e.rev}` }, actor);
    });
    return { ok: true };
  }
}
