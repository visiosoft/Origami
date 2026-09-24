import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RetentionReleaseEntity } from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { newId } from '../manpower/workforce.util';
import { computeSov, toDollars, type SovRow } from './finance.calc';
import { assertVersion, FinancialsService } from './financials.service';
import { billableItems, InvoicesService } from './invoices.service';
import { allocate, fromCents, sumCents, toCents } from './money';

export const RELEASE_REASONS = ['substantial_completion', 'final_completion', 'milestone_accepted', 'partial', 'other'];
const OPEN = ['requested', 'approved'];
const now = () => new Date().toISOString();
const fmtUsd = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Retention: accrued on every contract-work line when it's invoiced, paid back
 * by release. A release is requested for the project, a milestone or a task,
 * approved, then billed on a retention invoice whose lines return the money to
 * the items that held it.
 */
@Injectable()
export class RetentionService {
  constructor(
    @InjectRepository(RetentionReleaseEntity) private readonly repo: Repository<RetentionReleaseEntity>,
    private readonly fin: FinancialsService,
    private readonly invoices: InvoicesService,
  ) {}

  private async load(id: string) {
    const r = await this.repo.findOneBy({ id });
    if (!r) throw new NotFoundException('Retention release not found');
    return r;
  }

  /** Retention held on each billing item now, and on each milestone as a whole. */
  private async held(projectId: number) {
    const sov = computeSov((await this.fin.context(projectId)).input);
    const items = billableItems(sov).filter((r) => r.retentionC > 0);
    const flat = sov.groups.flatMap((g) => g.rows.flatMap((r) => [r, ...(r.children || [])]));
    return { sov, items, flat, totalC: sov.summary.retentionHeldC };
  }

  private scopeHeldC(h: Awaited<ReturnType<RetentionService['held']>>, scope: string, targetId?: string | null) {
    if (scope === 'project') return h.totalC;
    const row = scope === 'phase' ? h.flat.find((r) => r.kind === 'phase' && r.id === targetId) : h.flat.find((r) => r.kind === 'task' && r.id === targetId);
    if (!row) throw new BadRequestException(`That ${scope === 'phase' ? 'milestone' : 'task'} isn’t on this project.`);
    return row.retentionC;
  }

  async overview(projectId: number, actor: Actor) {
    const rights = await this.fin.need(actor, 'view');
    const [h, releases] = await Promise.all([this.held(projectId), this.repo.find({ where: { projectId } })]);
    const openC = sumCents(releases.filter((r) => OPEN.includes(r.status)).map((r) => toCents(r.amount)));
    const s = h.sov.summary;
    const rows = h.flat.filter((r) => r.retentionC > 0 || (r.retentionReleasedC || 0) > 0).map((r) => ({
      kind: r.kind, id: r.id, name: r.name, phaseId: r.phaseId || null, ...toDollars({ heldC: r.retentionC, releasedC: r.retentionReleasedC || 0, accruedC: r.retentionC + (r.retentionReleasedC || 0) }),
    }));
    if (h.sov.lump && (h.sov.lump.retentionC || h.sov.lump.retentionReleasedC)) {
      const l = h.sov.lump;
      rows.unshift({ kind: 'project', id: String(projectId), name: l.name, phaseId: null, ...toDollars({ heldC: l.retentionC, releasedC: l.retentionReleasedC || 0, accruedC: l.retentionC + (l.retentionReleasedC || 0) }) });
    }
    return {
      ...toDollars({ accruedC: s.retentionAccruedC, releasedC: s.retentionReleasedC, heldC: s.retentionHeldC, openC, availableC: Math.max(s.retentionHeldC - openC, 0) }),
      items: rows,
      releases: releases.sort((a, b) => b.number.localeCompare(a.number)),
      canRelease: rights.releaseRetention, canRequest: rights.prepareInvoice || rights.releaseRetention,
    };
  }

  async request(projectId: number, dto: { scope?: string; targetId?: string; amount?: number | string; reason?: string; notes?: string }, actor: Actor) {
    const rights = await this.fin.rights(actor);
    if (!rights.prepareInvoice && !rights.releaseRetention) throw new BadRequestException("Your role doesn't allow requesting retention releases.");
    await this.fin.project(projectId);
    const scope = ['project', 'phase', 'task'].includes(dto.scope || '') ? dto.scope! : 'project';
    const targetId = scope === 'project' ? null : String(dto.targetId || '');
    const h = await this.held(projectId);
    const releases = await this.repo.find({ where: { projectId } });
    const open = releases.filter((r) => OPEN.includes(r.status));
    const amountC = dto.amount == null || dto.amount === '' ? null : toCents(dto.amount as any);
    const scopeHeld = this.scopeHeldC(h, scope, targetId);
    const scopeOpen = sumCents(open.filter((r) => r.scope === scope && (r.targetId || null) === targetId).map((r) => toCents(r.amount)));
    const projectAvail = h.totalC - sumCents(open.map((r) => toCents(r.amount)));
    const availC = Math.min(scopeHeld - scopeOpen, projectAvail);
    const want = amountC ?? availC;
    if (want <= 0) throw new BadRequestException(availC <= 0 ? 'No retention is held there that isn’t already being released.' : 'The release must be more than zero.');
    if (want > availC) throw new BadRequestException(`Only ${fmtUsd(availC)} of retention is available to release there.`);
    const reason = RELEASE_REASONS.includes(dto.reason || '') ? dto.reason! : 'substantial_completion';
    let saved: RetentionReleaseEntity | null = null;
    for (let attempt = 0; attempt < 3 && !saved; attempt++) {
      try {
        saved = await this.repo.save(this.repo.create({
          id: newId('RR'), projectId, number: await this.fin.nextProjectNumber(this.repo, projectId, 'RR'), scope, targetId: targetId || undefined,
          amount: fromCents(want), reason, notes: dto.notes?.trim() || undefined, status: 'requested', requestedBy: actor.name, createdAt: now(), createdBy: actor.name,
        } as Partial<RetentionReleaseEntity>));
      } catch (e) { if (attempt === 2) throw e; }
    }
    await this.fin.approval(null, { projectId, entityType: 'retention_release', entityId: saved!.id, decision: 'requested', amount: saved!.amount, comment: dto.notes }, actor);
    await this.fin.log(null, { projectId, entityType: 'retention_release', entityId: saved!.id, action: 'retention_release_requested', changes: { amount: { from: null, to: saved!.amount } } }, actor);
    return this.overview(projectId, actor);
  }

  async decide(id: string, dto: { decision: 'approve' | 'reject' | 'cancel'; reason?: string; version?: number }, actor: Actor) {
    const r = await this.load(id);
    assertVersion(r, dto.version);
    const at = now();
    if (dto.decision === 'cancel') {
      const rights = await this.fin.rights(actor);
      if (!rights.prepareInvoice && !rights.releaseRetention) throw new BadRequestException("Your role doesn't allow cancelling retention releases.");
      if (!OPEN.includes(r.status)) throw new BadRequestException(`This release is ${r.status}.`);
      if (r.invoiceId) throw new BadRequestException('It’s on a draft invoice -- remove it from the draft (or delete the draft) first.');
      Object.assign(r, { status: 'cancelled', closedReason: dto.reason?.trim() || null });
    } else {
      await this.fin.need(actor, 'releaseRetention');
      if (r.status !== 'requested') throw new BadRequestException(`This release is ${r.status}.`);
      if (dto.decision === 'approve') {
        // Held retention may have moved since the request (a credit note, say).
        const h = await this.held(r.projectId);
        const scopeHeld = this.scopeHeldC(h, r.scope, r.targetId);
        if (toCents(r.amount) > scopeHeld) throw new BadRequestException(`Only ${fmtUsd(scopeHeld)} is held there now -- reject this and request the right amount.`);
        Object.assign(r, { status: 'approved', approvedAt: at, approvedBy: actor.name });
      } else {
        if (!dto.reason?.trim()) throw new BadRequestException('Say why it’s rejected.');
        Object.assign(r, { status: 'rejected', rejectedAt: at, rejectedBy: actor.name, closedReason: dto.reason.trim() });
      }
    }
    Object.assign(r, { updatedAt: at, updatedBy: actor.name });
    await this.repo.save(r);
    const decision = dto.decision === 'approve' ? 'approved' : dto.decision === 'reject' ? 'rejected' : 'cancelled';
    await this.fin.approval(null, { projectId: r.projectId, entityType: 'retention_release', entityId: id, decision, comment: dto.reason, amount: r.amount }, actor);
    await this.fin.log(null, { projectId: r.projectId, entityType: 'retention_release', entityId: id, action: `retention_release_${decision}`, reason: dto.reason?.trim() }, actor);
    return this.overview(r.projectId, actor);
  }

  /**
   * Bill an approved release: a retention invoice whose lines hand the money
   * back to the items that held it -- one item for a task or milestone billed
   * as a whole, or spread over the items in proportion to what each holds.
   */
  async bill(id: string, actor: Actor) {
    await this.fin.need(actor, 'prepareInvoice');
    const r = await this.load(id);
    if (r.status !== 'approved') throw new BadRequestException('Only an approved release can be billed.');
    if (r.invoiceId) return this.invoices.get(r.invoiceId, actor);
    const h = await this.held(r.projectId);
    let pool: SovRow[];
    if (r.scope === 'project') pool = h.items;
    else if (r.scope === 'task') pool = h.items.filter((x) => x.kind === 'task' && x.id === r.targetId);
    else {
      const phase = h.flat.find((x) => x.kind === 'phase' && x.id === r.targetId);
      pool = h.items.filter((x) => (x.kind === 'phase' && x.id === r.targetId) || (x.kind === 'task' && phase && x.phaseId === phase.id));
    }
    const amountC = toCents(r.amount);
    const heldC = sumCents(pool.map((x) => x.retentionC));
    if (amountC > heldC) throw new BadRequestException(`Only ${fmtUsd(heldC)} is held there now.`);
    const shares = allocate(amountC, pool.map((x) => x.retentionC));
    const lines = pool.map((x, i) => ({ item: x, amountC: shares[i] })).filter((l) => l.amountC > 0);
    return this.invoices.createReleaseDraft(r, lines.map((l) => ({
      kind: 'retention_release', retentionReleaseId: r.id, targetType: l.item.kind, phaseId: l.item.kind === 'phase' ? l.item.id : l.item.phaseId || null,
      taskId: l.item.kind === 'task' ? l.item.id : null, amount: fromCents(l.amountC), description: `Retention released (${r.number}) — ${l.item.name}`,
    })), actor);
  }
}
