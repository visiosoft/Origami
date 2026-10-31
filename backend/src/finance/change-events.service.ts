import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ChangeEventEntity, ChangeOrderEntity, ChangeOrderRequestEntity, CommitmentChangeOrderEntity, CommitmentEntity, CommitmentLineEntity, ProjectEntity,
} from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { newId, todayISO } from '../manpower/workforce.util';
import { ChangeOrdersService, CO_REASONS, CO_PARTY_TYPES } from './change-orders.service';
import { assertVersion, FinancialsService } from './financials.service';
import { GoogleService } from '../google/google.service';
import { emailShell, escapeHtml, loadEmailBrand } from '../email/shell';
import { SettingsService } from '../settings/settings.service';
import { fromCents, sumCents, toCents } from './money';

const now = () => new Date().toISOString();
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const COR_DECISIONS = { validate: 'validated', hold: 'hold', reject: 'rejected' } as const;
export const DIRECTIVE_TYPES = ['ccd', 'dcd'];
export const DIRECTIVE_METHODS = ['signature', 'verbal', 'email'];
const text = (v: unknown, max = 8000) => String(v ?? '').trim().slice(0, max) || null;

/**
 * The change order workflow (Oct 26 review notes, slides 15-18):
 *
 *   CE (change event) -> PCO (pricing asked of the subs it touches)
 *     -> CORs (each party's price; validated / hold / rejected)
 *     -> PCCO (validated CORs rolled into an owner change order -- the existing
 *        change order, signed by the owner; approval updates the prime contract)
 *     -> CCOs (one per sub, made when the PCCO is approved; signing one adds the
 *        change to that sub's subcontract).
 *
 * A CCD / DCD directive on the event lets the work proceed before pricing is
 * agreed; pricing carries on alongside it.
 */
@Injectable()
export class ChangeEventsService {
  constructor(
    @InjectRepository(ChangeEventEntity) private readonly events: Repository<ChangeEventEntity>,
    @InjectRepository(ChangeOrderRequestEntity) private readonly cors: Repository<ChangeOrderRequestEntity>,
    @InjectRepository(CommitmentChangeOrderEntity) private readonly ccos: Repository<CommitmentChangeOrderEntity>,
    @InjectRepository(ChangeOrderEntity) private readonly pccos: Repository<ChangeOrderEntity>,
    @InjectRepository(CommitmentEntity) private readonly commitments: Repository<CommitmentEntity>,
    @InjectRepository(CommitmentLineEntity) private readonly lines: Repository<CommitmentLineEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly fin: FinancialsService,
    private readonly changeOrders: ChangeOrdersService,
    @Optional() private readonly google?: GoogleService,
    @Optional() private readonly settings?: SettingsService,
  ) {
    // An approved PCCO makes its subs' CCOs.
    changeOrders.onApproved.push((co, actor) => this.makeCcos(co, actor));
  }

  // ------------------------------------------------------------------ reading

  private async projectNames() {
    return this.projects.find({ select: { id: true, name: true } });
  }

  /** Change events (one project's, or all), each with its CORs and what came of them. */
  async list(projectId: number | null, actor: Actor) {
    await this.fin.need(actor, 'viewChangeOrders');
    const where = projectId ? { projectId } : {};
    const [events, cors, ccos] = await Promise.all([this.events.find({ where }), this.cors.find({ where }), this.ccos.find({ where })]);
    const projects = new Map((await this.projectNames()).map((p) => [p.id, p.name]));
    return events
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((e) => this.shape(e, cors.filter((c) => c.changeEventId === e.id), ccos, projects.get(e.projectId)));
  }

  async get(id: string, actor: Actor) {
    await this.fin.need(actor, 'viewChangeOrders');
    const e = await this.load(id);
    const [cors, ccos, pccos] = await Promise.all([
      this.cors.find({ where: { changeEventId: id } }),
      this.ccos.find({ where: { projectId: e.projectId } }),
      e.changeOrderIds?.length ? this.pccos.find({ where: { id: In(e.changeOrderIds) } }) : Promise.resolve([] as ChangeOrderEntity[]),
    ]);
    const projects = new Map((await this.projectNames()).map((p) => [p.id, p.name]));
    return { ...this.shape(e, cors, ccos, projects.get(e.projectId)), pccos: pccos.map((c) => ({ id: c.id, number: c.number, title: c.title, status: c.status, amount: c.amount })) };
  }

  /** Sub change orders (one project's, or all). */
  async listCcos(projectId: number | null, actor: Actor) {
    await this.fin.need(actor, 'viewChangeOrders');
    const rows = await this.ccos.find({ where: projectId ? { projectId } : {} });
    const pccos = rows.length ? await this.pccos.find({ where: { id: In([...new Set(rows.map((r) => r.changeOrderId))]) } }) : [];
    const projects = new Map((await this.projectNames()).map((p) => [p.id, p.name]));
    return rows.sort((a, b) => b.number.localeCompare(a.number)).map((r) => ({
      ...r, projectName: projects.get(r.projectId), pcco: pccos.find((p) => p.id === r.changeOrderId)?.number,
    }));
  }

  private shape(e: ChangeEventEntity, cors: ChangeOrderRequestEntity[], ccos: CommitmentChangeOrderEntity[], projectName?: string) {
    const list = cors.sort((a, b) => a.number.localeCompare(b.number));
    const validated = list.filter((c) => c.status === 'validated');
    return {
      ...e, projectName,
      cors: list,
      ccos: ccos.filter((x) => list.some((c) => c.id === x.corId)),
      totals: {
        requested: list.length,
        priced: list.filter((c) => c.amount != null).length,
        validated: validated.length,
        validatedCost: fromCents(sumCents(validated.map((c) => toCents(c.amount ?? 0)))),
        scheduleImpactDays: validated.reduce((m, c) => Math.max(m, c.scheduleImpactDays || 0), 0),
      },
    };
  }

  private async load(id: string) {
    const e = await this.events.findOneBy({ id });
    if (!e) throw new NotFoundException('Change event not found.');
    return e;
  }

  private async loadCor(id: string) {
    const c = await this.cors.findOneBy({ id });
    if (!c) throw new NotFoundException('Change order request not found.');
    return c;
  }

  // ------------------------------------------------------------------ the change event

  async create(projectId: number, dto: any, actor: Actor) {
    await this.fin.need(actor, 'editChangeOrders');
    await this.fin.project(projectId);
    const title = text(dto.title, 300);
    if (!title) throw new BadRequestException('Say what changed.');
    let e: ChangeEventEntity | null = null;
    for (let attempt = 0; attempt < 3 && !e; attempt++) {
      const number = await this.fin.nextProjectNumber(this.events, projectId, 'CE');
      try {
        e = await this.events.save(this.events.create({
          id: newId('CE'), projectId, number, title, description: text(dto.description) ?? undefined,
          reason: CO_REASONS.includes(dto.reason) ? dto.reason : 'client_request',
          originatorType: CO_PARTY_TYPES.includes(dto.originatorType) ? dto.originatorType : undefined,
          status: 'open', changeOrderIds: [], createdAt: now(), createdBy: actor.name,
        }));
      } catch (err) { if (attempt === 2) throw err; }
    }
    await this.fin.log(null, { projectId, entityType: 'change_event', entityId: e!.id, action: 'ce_created', changes: { number: { from: null, to: e!.number } } }, actor);
    return this.get(e!.id, actor);
  }

  async update(id: string, dto: any, actor: Actor) {
    await this.fin.need(actor, 'editChangeOrders');
    const e = await this.load(id);
    assertVersion(e, dto.version);
    if (dto.title !== undefined) { const t = text(dto.title, 300); if (!t) throw new BadRequestException('Say what changed.'); e.title = t; }
    if (dto.description !== undefined) e.description = text(dto.description) as any;
    if (dto.reason !== undefined) { if (!CO_REASONS.includes(dto.reason)) throw new BadRequestException('Unknown driver.'); e.reason = dto.reason; }
    if (dto.originatorType !== undefined) e.originatorType = CO_PARTY_TYPES.includes(dto.originatorType) ? dto.originatorType : (null as any);
    if (dto.status !== undefined) {
      if (!['open', 'closed', 'void'].includes(dto.status)) throw new BadRequestException('A change event can be reopened, closed or voided.');
      e.status = dto.status;
    }
    Object.assign(e, { updatedAt: now(), updatedBy: actor.name });
    await this.events.save(e);
    return this.get(id, actor);
  }

  /**
   * The PCO: ask the subs a change touches to price it (and/or price it
   * ourselves). Each party gets a COR waiting for their price; with `email`,
   * those with an address are emailed the request.
   */
  async sendPco(id: string, dto: { parties?: any[]; note?: string; due?: string; email?: boolean }, actor: Actor) {
    await this.fin.need(actor, 'editChangeOrders');
    const e = await this.load(id);
    const parties = (Array.isArray(dto.parties) ? dto.parties : []).map((p) => ({
      partyType: p?.partyType === 'prime' ? 'prime' : 'sub',
      partyName: text(p?.name, 200), partyEmail: text(p?.email, 200), commitmentId: text(p?.commitmentId, 80), contractorId: text(p?.contractorId, 80),
    })).filter((p) => p.partyName);
    if (!parties.length) throw new BadRequestException('Pick who prices it.');
    if (dto.due && !ISO.test(dto.due)) throw new BadRequestException('The due date must be a date.');
    const at = now();
    const made: ChangeOrderRequestEntity[] = [];
    for (const p of parties) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const number = await this.fin.nextProjectNumber(this.cors, e.projectId, 'COR');
        try {
          const row: Partial<ChangeOrderRequestEntity> = {
            id: newId('COR'), projectId: e.projectId, changeEventId: e.id, number,
            partyType: p.partyType, partyName: p.partyName!, partyEmail: p.partyEmail ?? undefined, commitmentId: p.commitmentId ?? undefined, contractorId: p.contractorId ?? undefined,
            scope: text(dto.note) ?? e.description ?? e.title, status: 'requested', requestedAt: at, createdAt: at, createdBy: actor.name,
          };
          made.push(await this.cors.save(this.cors.create(row)));
          break;
        } catch (err) { if (attempt === 2) throw err; }
      }
    }
    Object.assign(e, { status: 'pricing', pcoSentAt: at, pcoDue: dto.due || null, pcoNote: text(dto.note), updatedAt: at, updatedBy: actor.name });
    await this.events.save(e);
    await this.fin.log(null, { projectId: e.projectId, entityType: 'change_event', entityId: e.id, action: 'pco_sent', changes: { to: { from: null, to: parties.map((p) => p.partyName).join(', ') } } }, actor);
    const emailed: string[] = [];
    if (dto.email && this.google && await this.google.isConnected().catch(() => false)) {
      const project = await this.fin.project(e.projectId);
      const brand = this.settings ? await loadEmailBrand(this.settings).catch(() => null) : null;
      for (const c of made.filter((c) => c.partyEmail)) {
        const body = `<p>Please price this change on <b>${escapeHtml(project.name)}</b> and send us your proposal (cost and any schedule impact)${dto.due ? ` by <b>${escapeHtml(dto.due)}</b>` : ''}.</p>`
          + `<p><b>${escapeHtml(e.number)} · ${escapeHtml(e.title)}</b></p><p style="white-space:pre-wrap">${escapeHtml(c.scope || '')}</p><p>Reference: ${escapeHtml(c.number)}</p>`;
        const html = brand
          ? emailShell({ brand, eyebrow: `Pricing request · ${c.number}`, title: `Hello ${escapeHtml(c.partyName)},`, body, footer: `Sent by ${escapeHtml(actor.name)} at ${escapeHtml(brand.companyName)}.` })
          : `<p>Hello ${escapeHtml(c.partyName)},</p>${body}`;
        await this.google.sendMail({ to: c.partyEmail!, subject: `Pricing request ${c.number} — ${project.name}: ${e.title}`, html })
          .then(() => emailed.push(c.partyName)).catch(() => undefined);
      }
    }
    return { ...(await this.get(id, actor)), emailed };
  }

  /** Record a CCD / DCD: the work may proceed now, priced alongside it. */
  async directive(id: string, dto: { type?: string; method?: string; signer?: string; date?: string; note?: string }, actor: Actor) {
    await this.fin.need(actor, 'editChangeOrders');
    const e = await this.load(id);
    if (!DIRECTIVE_TYPES.includes(String(dto.type))) throw new BadRequestException('Construction (CCD) or design (DCD) directive?');
    if (!DIRECTIVE_METHODS.includes(String(dto.method))) throw new BadRequestException('Signed, verbal or by email?');
    if (dto.date && !ISO.test(dto.date)) throw new BadRequestException('The directive date must be a date.');
    if (dto.method === 'signature' && !text(dto.signer)) throw new BadRequestException('Who signed it?');
    Object.assign(e, {
      directiveType: dto.type, directiveMethod: dto.method, directiveSigner: text(dto.signer, 200), directiveDate: dto.date || todayISO(),
      directiveNote: text(dto.note), directiveBy: actor.name, updatedAt: now(), updatedBy: actor.name,
    });
    await this.events.save(e);
    await this.fin.log(null, { projectId: e.projectId, entityType: 'change_event', entityId: e.id, action: 'directive', changes: { directive: { from: null, to: `${String(dto.type).toUpperCase()} (${dto.method})` } } }, actor);
    return this.get(id, actor);
  }

  // ------------------------------------------------------------------ CORs

  /** Add a COR by hand (e.g. our own price as prime, or a sub who wasn't asked through the PCO). */
  async addCor(id: string, dto: any, actor: Actor) {
    return this.sendPco(id, { parties: [{ partyType: dto.partyType, name: dto.name, email: dto.email, commitmentId: dto.commitmentId, contractorId: dto.contractorId }], note: dto.scope }, actor)
      .then(async (r) => (dto.amount != null ? this.priceCor(r.cors[r.cors.length - 1].id, dto, actor) : r));
  }

  /** The party's proposal: price, schedule impact, scope as they priced it. */
  async priceCor(corId: string, dto: any, actor: Actor) {
    await this.fin.need(actor, 'editChangeOrders');
    const c = await this.loadCor(corId);
    if (c.changeOrderId) throw new BadRequestException('This COR is already in an owner change order.');
    const amountC = toCents(dto.amount);
    if (dto.amount === '' || dto.amount == null || !Number.isFinite(Number(dto.amount))) throw new BadRequestException('Give their price (negative for a credit).');
    const days = Number(dto.scheduleImpactDays ?? c.scheduleImpactDays ?? 0);
    if (!Number.isInteger(days) || Math.abs(days) > 3650) throw new BadRequestException('Schedule impact is a whole number of days.');
    Object.assign(c, {
      amount: fromCents(amountC), scheduleImpactDays: days, scope: dto.scope !== undefined ? text(dto.scope) : c.scope,
      status: c.status === 'requested' ? 'submitted' : c.status, submittedAt: c.submittedAt || now(), updatedAt: now(), updatedBy: actor.name,
    });
    await this.cors.save(c);
    await this.syncEventStatus(c.changeEventId);
    return this.get(c.changeEventId, actor);
  }

  /** Our decision on a COR: validate it (it can go into a PCCO), hold it, or reject it. */
  async decideCor(corId: string, decision: string, note: string | undefined, actor: Actor) {
    await this.fin.need(actor, 'editChangeOrders');
    const c = await this.loadCor(corId);
    const to = COR_DECISIONS[decision as keyof typeof COR_DECISIONS];
    if (!to) throw new BadRequestException('Validate, hold or reject.');
    if (c.changeOrderId) throw new BadRequestException('This COR is already in an owner change order.');
    if (to === 'validated' && c.amount == null) throw new BadRequestException('Enter their price before validating it.');
    if (to !== 'validated' && !text(note)) throw new BadRequestException('Say why.');
    Object.assign(c, { status: to, decidedAt: now(), decidedBy: actor.name, decisionNote: text(note), updatedAt: now(), updatedBy: actor.name });
    await this.cors.save(c);
    await this.fin.log(null, { projectId: c.projectId, entityType: 'change_order_request', entityId: c.id, action: `cor_${to}`, reason: text(note) ?? undefined }, actor);
    await this.syncEventStatus(c.changeEventId);
    return this.get(c.changeEventId, actor);
  }

  private async syncEventStatus(eventId: string) {
    const e = await this.load(eventId);
    if (['closed', 'void'].includes(e.status)) return;
    const cors = await this.cors.find({ where: { changeEventId: eventId } });
    const open = cors.filter((c) => !c.changeOrderId && c.status !== 'rejected');
    e.status = !cors.length ? 'open' : open.length && open.every((c) => c.status !== 'requested') ? 'priced' : 'pricing';
    await this.events.save(e);
  }

  // ------------------------------------------------------------------ PCCO

  /**
   * Roll validated CORs (from one or more change events on a project) into an
   * owner change order (PCCO) draft: one line per COR at its cost plus markup,
   * the longest schedule impact, the events' driver.
   */
  async makePcco(dto: { corIds?: string[]; title?: string; markupPct?: number | string }, actor: Actor) {
    await this.fin.need(actor, 'editChangeOrders');
    const ids = [...new Set((dto.corIds || []).map(String))];
    if (!ids.length) throw new BadRequestException('Pick the validated CORs to include.');
    const cors = await this.cors.find({ where: { id: In(ids) } });
    if (cors.length !== ids.length) throw new NotFoundException('A change order request is missing.');
    if (new Set(cors.map((c) => c.projectId)).size > 1) throw new BadRequestException('Pick CORs from one project.');
    const bad = cors.find((c) => c.status !== 'validated' || c.changeOrderId);
    if (bad) throw new BadRequestException(`${bad.number} isn't validated (or is already in a change order).`);
    const markup = dto.markupPct === undefined || dto.markupPct === '' ? 0 : Number(dto.markupPct);
    if (!Number.isFinite(markup) || markup < 0 || markup > 200) throw new BadRequestException('Markup is a percentage from 0 to 200.');
    const events = await this.events.find({ where: { id: In([...new Set(cors.map((c) => c.changeEventId))]) } });
    const projectId = cors[0].projectId;
    const title = text(dto.title, 300) || (events.length === 1 ? events[0].title : `${events.map((e) => e.number).join(', ')}`);
    const co: any = await this.changeOrders.create(projectId, {
      title, reason: events[0]?.reason, originatorType: events[0]?.originatorType,
      description: events.map((e) => `${e.number} · ${e.title}${e.description ? `\n${e.description}` : ''}`).join('\n\n'),
      scheduleImpactDays: cors.reduce((m, c) => Math.max(m, c.scheduleImpactDays || 0), 0),
      items: cors.map((c) => ({
        description: `${c.number} ${c.partyName}: ${c.scope || events.find((e) => e.id === c.changeEventId)?.title || ''}`.slice(0, 2000),
        targetType: 'none', amount: fromCents(Math.round(toCents(c.amount ?? 0) * (1 + markup / 100))), cost: c.amount,
      })),
    }, actor);
    await this.pccos.update({ id: co.id }, { changeEventIds: events.map((e) => e.id) });
    for (const c of cors) { c.changeOrderId = co.id; c.updatedAt = now(); c.updatedBy = actor.name; }
    await this.cors.save(cors);
    for (const e of events) { e.changeOrderIds = [...new Set([...(e.changeOrderIds || []), co.id])]; await this.events.save(e); await this.syncEventStatus(e.id); }
    await this.fin.log(null, { projectId, entityType: 'change_order', entityId: co.id, action: 'pcco_from_cors', changes: { cors: { from: null, to: cors.map((c) => c.number).join(', ') } } }, actor);
    return { changeOrderId: co.id, number: co.number };
  }

  // ------------------------------------------------------------------ CCOs

  /** When a PCCO is approved: one CCO draft per sub COR in it (prime CORs have no sub to change). */
  async makeCcos(co: ChangeOrderEntity, actor: Actor) {
    const cors = (await this.cors.find({ where: { changeOrderId: co.id } })).filter((c) => c.partyType === 'sub');
    const existing = await this.ccos.find({ where: { changeOrderId: co.id } });
    for (const c of cors.filter((x) => !existing.some((e) => e.corId === x.id))) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const number = await this.fin.nextProjectNumber(this.ccos, co.projectId, 'CCO');
        try {
          await this.ccos.save(this.ccos.create({
            id: newId('CCO'), projectId: co.projectId, number, changeOrderId: co.id, corId: c.id, commitmentId: c.commitmentId || undefined,
            partyName: c.partyName, partyEmail: c.partyEmail || undefined, scope: c.scope || undefined, amount: c.amount ?? 0,
            scheduleImpactDays: c.scheduleImpactDays || 0, status: 'draft', createdAt: now(), createdBy: actor.name,
          }));
          break;
        } catch (err) { if (attempt === 2) throw err; }
      }
    }
  }

  /** A CCO: sent to the sub, signed (which changes their subcontract), or voided. */
  async actCco(id: string, action: string, dto: any, actor: Actor) {
    await this.fin.need(actor, 'editChangeOrders');
    const c = await this.ccos.findOneBy({ id });
    if (!c) throw new NotFoundException('Sub change order not found.');
    const at = now();
    if (action === 'send') {
      if (c.status !== 'draft') throw new BadRequestException('Only a draft is sent.');
      Object.assign(c, { status: 'sent', sentAt: at });
    } else if (action === 'sign') {
      if (!['draft', 'sent'].includes(c.status)) throw new BadRequestException('Only an open sub change order is signed.');
      const signer = text(dto?.signer, 200);
      if (!signer) throw new BadRequestException('Who signed it for the sub?');
      if (dto?.date && !ISO.test(dto.date)) throw new BadRequestException('The signed date must be a date.');
      // Signing changes their subcontract: the change goes on as a line.
      if (c.commitmentId) {
        const sc = await this.commitments.findOneBy({ id: c.commitmentId });
        if (sc && sc.status !== 'void') {
          const order = (await this.lines.find({ where: { commitmentId: sc.id } })).reduce((m, l) => Math.max(m, l.lineOrder), -1) + 1;
          const line = await this.lines.save(this.lines.create({ id: newId('CL'), commitmentId: sc.id, projectId: c.projectId, lineOrder: order, description: `${c.number}: ${c.scope || 'Change'}`.slice(0, 2000), amount: c.amount }));
          c.commitmentLineId = line.id;
        }
      }
      Object.assign(c, { status: 'signed', signer, signedAt: dto?.date || todayISO(), signedReference: text(dto?.reference, 200) });
    } else if (action === 'void') {
      if (c.status === 'signed') throw new BadRequestException('A signed sub change order is part of the subcontract -- make a new one to reverse it.');
      if (!text(dto?.reason)) throw new BadRequestException('Say why.');
      c.status = 'void';
    } else throw new BadRequestException('Unknown action.');
    Object.assign(c, { updatedAt: at, updatedBy: actor.name });
    await this.ccos.save(c);
    await this.fin.log(null, { projectId: c.projectId, entityType: 'commitment_change_order', entityId: c.id, action: `cco_${action}`, reason: text(dto?.reason) ?? undefined }, actor);
    return c;
  }
}
