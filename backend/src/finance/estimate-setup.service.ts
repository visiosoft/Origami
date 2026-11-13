import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CsiCodeEntity } from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { CostsService } from './costs.service';
import { EstimatesService } from './estimates.service';
import { setupPlan, SETUP_STEPS, type SetupStep } from './estimate-setup';
import { FinancialsService } from './financials.service';
import { fromCents } from './money';

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
    return { ...raw, plan };
  }

  async preview(projectId: number, id: string, actor: Actor) {
    const { e, plan } = await this.load(projectId, id, actor);
    const { value: fs, row } = await this.fin.settingsFor(projectId);
    const d = (c: number) => fromCents(c);
    return {
      done: e.setupRefs || {}, setupAt: e.setupAt, setupBy: e.setupBy,
      contract: { current: row ? Number(fs.originalContractValue) || 0 : null, proposed: d(plan.contract), locked: !!fs.contractLockedAt },
      budget: plan.budget.map((b) => ({ ...b, amount: d(b.amount) })),
      subcontracts: plan.subcontracts.map((s) => ({ ...s, total: d(s.total), lines: s.lines.map((l) => ({ ...l, amount: d(l.amount) })) })),
      milestones: plan.milestones.map((m) => ({ ...m, amount: d(m.amount) })),
    };
  }

  /** Runs the ticked steps not yet done, in order: contract, budget, subcontracts, milestones. */
  async apply(projectId: number, id: string, dto: { steps?: SetupStep[] }, actor: Actor) {
    const { e, plan } = await this.load(projectId, id, actor);
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
          await this.fin.saveSettings(projectId, { version: row?.version, originalContractValue: fromCents(plan.contract) }, actor);
          refs.contract = { amount: fromCents(plan.contract) };
        } else if (step === 'budget') {
          for (const b of plan.budget) await this.costs.saveBudgetLine(projectId, { csiCodeId: b.csiCodeId, amount: fromCents(b.amount), description: `${b.label} (from ${e.number} Rev ${e.rev})` }, actor);
          refs.budget = { lines: plan.budget.length };
        } else if (step === 'subcontracts') {
          const made: string[] = [];
          for (const s of plan.subcontracts) {
            await this.costs.saveCommitment(projectId, { type: 'subcontract', contractorId: s.contractorId, vendorName: s.vendorName, title: s.title, scope: `From ${e.number} Rev ${e.rev}`, lines: s.lines.map((l) => ({ description: l.description, csiCodeId: l.csiCodeId, amount: fromCents(l.amount) })) }, actor);
            made.push(s.vendorName || s.contractorId || '');
          }
          refs.subcontracts = { count: made.length, subs: made };
        } else if (step === 'milestones') {
          for (const m of plan.milestones) await this.fin.addMilestone(projectId, { name: m.name, contractValue: fromCents(m.amount) }, actor);
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
