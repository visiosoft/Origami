import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CsiCodeEntity } from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { CostsService } from './costs.service';
import { EstimatesService } from './estimates.service';
import { contractAfter, matchSubcontracts, setupPlan, SETUP_STEPS, type SetupStep } from './estimate-setup';
import { FinancialsService } from './financials.service';
import { fromCents, toCents } from './money';

/**
 * K9 (Nov 13): "Set up the job" from an accepted estimate. Shows what it
 * would make, then -- only when someone confirms -- sets the contract value,
 * adds budget lines per CSI code, draft subcontracts and the billing
 * milestones, through the same services the Financials screens use (their
 * own permission checks apply). Each step runs once; what it made is linked.
 */
@Injectable()
export class EstimateSetupService {
  constructor(
    private readonly estimates: EstimatesService,
    private readonly fin: FinancialsService,
    private readonly costs: CostsService,
    @InjectRepository(CsiCodeEntity) private readonly csi: Repository<CsiCodeEntity>,
  ) {}

  private async load(projectId: number, id: string, actor: Actor) {
    const raw = await this.estimates.raw(projectId, id, actor, 'edit');
    if (raw.e.status !== 'accepted') throw new ConflictException('Only an accepted estimate sets up the job.');
    if (!raw.rights!.money.full) throw new ForbiddenException('Setting up the job needs a role that sees all of the estimate’s money.');
    const plan = setupPlan({ scopes: raw.sheet.scopes, lines: raw.sheet.lines, payments: raw.e.payments || [], result: raw.result, csi: await this.csi.find() });
    // Nov 23 (Edward p30): the other estimates already set up on this project, the building this one prices, and the subcontracts it could join.
    const ctx = (await this.estimates.setupContext?.(projectId, raw.e.number)) || { otherSetups: 0, structures: [] as { key: string; name: string }[] };
    const structureKey = raw.e.structureKey || null;
    const building = structureKey ? ctx.structures.find((x) => x.key === structureKey)?.name || null : null;
    const drafts = (await this.costs.setupDrafts?.(projectId)) || [];
    const matches = matchSubcontracts(plan.subcontracts, drafts, structureKey);
    return { ...raw, plan, ctx, structureKey, building, matches };
  }

  async preview(projectId: number, id: string, actor: Actor) {
    const { e, plan, ctx, building, matches } = await this.load(projectId, id, actor);
    const { value: fs, row } = await this.fin.settingsFor(projectId);
    const d = (c: number) => fromCents(c);
    const current = row ? Number(fs.originalContractValue) || 0 : null;
    const after = contractAfter(toCents(current || 0), ctx.otherSetups, plan.contract);
    return {
      done: e.setupRefs || {}, setupAt: e.setupAt, setupBy: e.setupBy, building,
      contract: { current, proposed: d(after.value), adds: d(plan.contract), mode: after.mode, otherSetups: ctx.otherSetups, locked: !!fs.contractLockedAt },
      budget: plan.budget.map((b) => ({ ...b, amount: d(b.amount) })),
      subcontracts: plan.subcontracts.map((s, i) => ({ ...s, total: d(s.total), lines: s.lines.map((l) => ({ ...l, amount: d(l.amount) })), joins: matches[i].joins?.number || null, note: matches[i].note })),
      milestones: plan.milestones.map((m) => ({ ...m, amount: d(m.amount) })),
    };
  }

  /** Runs the ticked steps not yet done, in order: contract, budget, subcontracts, milestones. */
  async apply(projectId: number, id: string, dto: { steps?: SetupStep[] }, actor: Actor) {
    const { e, plan, ctx, structureKey, building, matches } = await this.load(projectId, id, actor);
    const steps = SETUP_STEPS.filter((s) => (dto?.steps || []).includes(s));
    if (!steps.length) throw new BadRequestException('Tick at least one thing to set up.');
    const refs: Record<string, unknown> = { ...(e.setupRefs || {}) };
    const save = async () => { e.setupRefs = refs; await this.estimates.saveEntity(e); };
    for (const step of steps) {
      if (refs[step]) continue; // done already -- never twice
      try {
        if (step === 'contract') {
          const { row, value } = await this.fin.settingsFor(projectId);
          if (value.contractLockedAt) throw new ConflictException('The contract value is locked by issued invoices -- use a change order.');
          // The first estimate set up sets the contract value; later ones (ADU, the owner-funded part) add to it.
          const after = contractAfter(toCents(row ? Number(value.originalContractValue) || 0 : 0), ctx.otherSetups, plan.contract);
          await this.fin.saveSettings(projectId, { version: row?.version, originalContractValue: fromCents(after.value) }, actor);
          refs.contract = { amount: fromCents(plan.contract), mode: after.mode, total: fromCents(after.value) };
        } else if (step === 'budget') {
          for (const b of plan.budget) await this.costs.saveBudgetLine(projectId, { csiCodeId: b.csiCodeId, amount: fromCents(b.amount), description: `${b.label} (from ${e.number} Rev ${e.rev}${building ? ` · ${building}` : ''})` }, actor);
          refs.budget = { lines: plan.budget.length };
        } else if (step === 'subcontracts') {
          const made: string[] = [];
          const joined: string[] = [];
          for (const [i, s] of plan.subcontracts.entries()) {
            const lines = s.lines.map((l) => ({ description: l.description, csiCodeId: l.csiCodeId, amount: fromCents(l.amount) }));
            const join = matches[i]?.joins;
            if (join) {
              // Same sub, same building, only the funding differs (Edward p30, scenario 2): one subcontract.
              const old = await this.costs.commitmentLinesOf(join.id);
              await this.costs.saveCommitment(projectId, { id: join.id, version: (join as any).version, scope: `${join.scope}, ${e.number} Rev ${e.rev}`, lines: [...old, ...lines], reason: `Lines from ${e.number} Rev ${e.rev}` }, actor);
              joined.push(join.number);
            } else {
              await this.costs.saveCommitment(projectId, { type: 'subcontract', contractorId: s.contractorId, vendorName: s.vendorName, title: building ? `${s.title} – ${building}` : s.title, structureKey, scope: `From ${e.number} Rev ${e.rev}`, lines }, actor);
            }
            made.push(s.vendorName || s.contractorId || '');
          }
          refs.subcontracts = { count: made.length, subs: made, ...(joined.length ? { joined } : {}) };
        } else if (step === 'milestones') {
          const label = [building, e.number].filter(Boolean).join(' · ');
          for (const m of plan.milestones) await this.fin.addMilestone(projectId, { name: ctx.otherSetups > 0 || building ? `${m.name} (${label})` : m.name, contractValue: fromCents(m.amount), fundingSourceId: e.fundingSourceId || null }, actor);
          refs.milestones = { count: plan.milestones.length };
        }
        await save();
      } catch (err) {
        await save();
        const msg = (err as Error).message || 'it didn’t work';
        throw new BadRequestException(`${step === 'contract' ? 'Contract value' : step === 'budget' ? 'Budget' : step === 'subcontracts' ? 'Subcontracts' : 'Billing milestones'}: ${msg}${Object.keys(refs).length ? ` (already done: ${Object.keys(refs).join(', ')})` : ''}`);
      }
    }
    if (SETUP_STEPS.every((s) => refs[s] || !steps.includes(s))) { e.setupAt = new Date().toISOString(); e.setupBy = actor.name; await save(); }
    await this.fin.log(null, { projectId, entityType: 'estimate', entityId: e.id, action: 'job_set_up', reason: `${e.number} Rev ${e.rev}: ${steps.join(', ')}` }, actor);
    return this.preview(projectId, id, actor);
  }

  /** The client signed on paper: staff record the acceptance by hand. */
  async markAccepted(projectId: number, id: string, dto: { signer?: string }, actor: Actor) {
    const { e } = await this.estimates.raw(projectId, id, actor, 'edit');
    const signer = String(dto?.signer || '').trim().slice(0, 120);
    if (!signer) throw new BadRequestException('Who accepted it for the client?');
    if (e.status !== 'sent') throw new ConflictException('Only a sent estimate can be marked accepted.');
    const all = await this.estimates.revisionsOf(projectId, e.number);
    if (all.some((x) => x.status === 'accepted')) throw new ConflictException('This estimate has already been accepted.');
    e.status = 'accepted'; e.acceptedAt = new Date().toISOString(); e.acceptedBy = signer; e.signedName = signer; e.updatedAt = e.acceptedAt; e.updatedBy = actor.name;
    await this.estimates.saveEntity(e);
    await this.fin.log(null, { projectId, entityType: 'estimate', entityId: e.id, action: 'accepted', reason: `${e.number} Rev ${e.rev} marked accepted (${signer}) by ${actor.name}` }, actor);
    return this.estimates.get(projectId, id, actor);
  }
}
