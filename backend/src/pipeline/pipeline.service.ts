import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DealEntity, LeadEntity } from '../database/entities';
import { ProjectsService } from '../projects/projects.service';
import { STAGES, RETIRED_STAGE_KEYS, stageBlockedFor, deliveryCode } from '../seed-data/pipeline';

/** How many chases before the lead is handed on rather than chased again. */
export const MAX_FOLLOW_UPS = 3;

export interface FollowUpInput {
  method: string;
  outcome: string;
  note?: string;
  /** Who was chased: the lead, or one of their referrals. */
  target?: string;
  contactName?: string;
  /** On the last attempt, the person the lead is handed to. */
  assignToId?: string;
  assignToName?: string;
}

/** Who performed an action, for the audit trail. */
export interface DealActor { name: string; id?: string }

@Injectable()
export class PipelineService implements OnApplicationBootstrap {
  private readonly log = new Logger('PipelineService');

  constructor(
    @InjectRepository(DealEntity) private readonly repo: Repository<DealEntity>,
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
    private readonly projects: ProjectsService,
  ) {}

  /**
   * Stage indices moved when the hold and cold stages were inserted, so any
   * deal still holding an index from the old order is repaired against its
   * stage key — the key is the real identity, the index only orders the board.
   */
  async onApplicationBootstrap() {
    try {
      const deals = await this.repo.find();
      const stale = deals.filter((d) => {
        const idx = STAGES.findIndex((s) => s.key === d.stage);
        return idx >= 0 && d.stageIdx !== idx;
      });
      if (stale.length) {
        for (const deal of stale) deal.stageIdx = STAGES.findIndex((s) => s.key === deal.stage);
        await this.repo.save(stale);
        this.log.log(`Repaired stageIdx on ${stale.length} deal(s)`);
      }
      await this.rehomeRetiredStages(deals);

      // Deals predating the response clock get one derived from daysInStage,
      // so an old card is not treated as having just arrived.
      const undated = deals.filter((d) => !d.stageEnteredAt);
      if (undated.length) {
        const now = Date.now();
        for (const deal of undated) {
          const days = Number(deal.daysInStage) || 0;
          deal.stageEnteredAt = new Date(now - days * 86400000).toISOString();
        }
        await this.repo.save(undated);
        this.log.log(`Backfilled stageEnteredAt on ${undated.length} deal(s)`);
      }
    } catch (err) {
      this.log.warn('Stage index repair failed: ' + (err as Error).message);
    }
  }

  /**
   * Move deals off a stage that no longer exists.
   *
   * Forward, not back: the step was removed because it is not needed, so the
   * lead has effectively passed it — sending it backwards would undo progress
   * that actually happened. Stages the lead's delivery method rules out are
   * stepped over, and the move is written to the audit trail so nobody is left
   * wondering why a card jumped.
   */
  private async rehomeRetiredStages(deals: DealEntity[]) {
    const stranded = deals.filter((d) => RETIRED_STAGE_KEYS.includes(d.stage));
    if (!stranded.length) return;

    const order = STAGES.filter((s) => !s.isHold && !s.isClosed);
    for (const deal of stranded) {
      const lead = await this.leads.findOneBy({ id: deal.id });
      const target = order.find((s, i) => i >= 0 && s.idx >= 0 && !RETIRED_STAGE_KEYS.includes(s.key)
        && s.idx >= deal.stageIdx && !stageBlockedFor(lead?.contractType, s.key));
      if (!target) continue;

      deal.stage = target.key;
      deal.stageIdx = target.idx;
      deal.timeline = [
        ...((deal.timeline as unknown[]) || []),
        this.event(`Stage removed from the funnel — moved to ${target.name}`, { name: 'System' }),
      ];
      await this.repo.save(deal);
      this.log.log(`Moved ${deal.id} off a retired stage to ${target.key}`);
    }
  }

  getStages() {
    return STAGES; // stage definitions are static config, not row data
  }

  /** Archived deals are off the board unless they are explicitly asked for. */
  async findAll(includeArchived = false) {
    const deals = await this.repo.find();
    return includeArchived ? deals : deals.filter((d) => !d.archived);
  }

  async findOne(id: string) {
    const deal = await this.repo.findOneBy({ id });
    if (!deal) throw new NotFoundException(`Deal ${id} not found`);
    return deal;
  }

  create(dto: any) {
    return this.repo.save(this.repo.create(dto as Partial<DealEntity>));
  }

  async updateStage(id: string, stage: string, actor?: DealActor) {
    // Keep stageIdx in sync with the canonical stage order so the progress bar
    // and "Advance" logic stay correct after a reload; log the move to timeline.
    const idx = STAGES.findIndex((s) => s.key === stage);
    const target = idx >= 0 ? STAGES[idx] : undefined;
    const stageName = target?.name ?? stage;

    const deal = await this.findOne(id);

    // Some stages do not apply to a delivery method — a Build Only lead has
    // nothing to review at design fit or zoning. Enforced here rather than only
    // in the UI, so the rule holds however the move is made.
    const lead = await this.leads.findOneBy({ id });
    if (stageBlockedFor(lead?.contractType, stage)) {
      throw new BadRequestException(
        `${stageName} does not apply to a ${deliveryCode(lead?.contractType)} lead.`,
      );
    }

    deal.stage = stage;
    if (idx >= 0) deal.stageIdx = idx;
    // Restart the response clock: the target is time in *this* stage.
    deal.stageEnteredAt = new Date().toISOString();
    deal.daysInStage = 0;

    // A hold stage parks the lead until a date, so it can be brought back.
    if (target?.isHold && target.holdMonths) {
      deal.holdUntil = addMonths(new Date(), target.holdMonths).toISOString().slice(0, 10);
    } else {
      deal.holdUntil = '';
    }

    const detail = deal.holdUntil ? `Moved to ${stageName} — follow up ${deal.holdUntil}` : `Moved to ${stageName}`;
    deal.timeline = [...((deal.timeline as unknown[]) || []), this.event(detail, actor)];
    return this.repo.save(deal);
  }

  /** Take a deal off the board without destroying its history. */
  async setArchived(id: string, archived: boolean, actor?: DealActor) {
    const deal = await this.findOne(id);
    deal.archived = archived;
    deal.archivedAt = archived ? new Date().toISOString() : '';
    deal.timeline = [...((deal.timeline as unknown[]) || []), this.event(archived ? 'Archived' : 'Restored from archive', actor)];
    return this.repo.save(deal);
  }

  /** The internal team on this pursuit. */
  async setRoles(id: string, roles: Record<string, string>, actor?: DealActor) {
    const deal = await this.findOne(id);
    const before = deal.roles || {};
    deal.roles = { ...before, ...roles };
    const changed = Object.keys(roles).filter((k) => (before[k] || '') !== (roles[k] || ''));
    if (changed.length) {
      deal.timeline = [
        ...((deal.timeline as unknown[]) || []),
        this.event(`Role assignments updated: ${changed.join(', ')}`, actor),
      ];
    }
    return this.repo.save(deal);
  }

  /**
   * Record a chase on a lead.
   *
   * The coordinator gets a fixed number of attempts; the last one hands the
   * lead to a manager rather than being another call into the void. Everything
   * is audited, because "we tried three times" only means something if the
   * attempts are on the record.
   */
  async logFollowUp(id: string, input: FollowUpInput, actor?: DealActor) {
    const deal = await this.findOne(id);
    const existing = ((deal.followUps as any[]) || []);
    if (existing.length >= MAX_FOLLOW_UPS) {
      throw new BadRequestException(`All ${MAX_FOLLOW_UPS} attempts have been logged for ${deal.name}.`);
    }

    const attempt = existing.length + 1;
    const isLast = attempt >= MAX_FOLLOW_UPS;
    const who = input.contactName?.trim() || (input.target === 'referral' ? 'a referral' : deal.client || deal.name);

    const entry = {
      attempt,
      method: input.method,
      outcome: input.outcome,
      note: (input.note || '').trim(),
      target: input.target || 'lead',
      contactName: input.contactName?.trim() || '',
      at: new Date().toISOString(),
      by: actor?.name || 'Unknown',
      byId: actor?.id || '',
      assignedTo: isLast ? (input.assignToName || '') : '',
      assignedToId: isLast ? (input.assignToId || '') : '',
    };
    deal.followUps = [...existing, entry];

    // The last chase hands the lead on, so it stops sitting with the person
    // who has already failed to reach them three times.
    if (isLast && input.assignToName) {
      deal.assignee = input.assignToName;
      deal.assigneeInit = initialsOf(input.assignToName);
      deal.assignedRole = 'PM';
      deal.status = 'awaiting_pm';
    }

    const detail = `Attempt ${attempt} of ${MAX_FOLLOW_UPS} — ${input.method}, ${input.outcome} (${who})`;
    deal.timeline = [
      ...((deal.timeline as unknown[]) || []),
      this.event(detail, actor, 'pc'),
      ...(isLast && input.assignToName
        ? [this.event(`Handed to ${input.assignToName} after ${MAX_FOLLOW_UPS} attempts`, actor, 'pm')]
        : []),
    ];

    return this.repo.save(deal);
  }

  /** Append a note or any other audited action to the trail. */
  async addEvent(id: string, action: string, actor?: DealActor, type: 'auto' | 'pc' | 'pm' = 'auto') {
    const deal = await this.findOne(id);
    deal.timeline = [...((deal.timeline as unknown[]) || []), this.event(action, actor, type)];
    return this.repo.save(deal);
  }

  /**
   * One audit entry. `role` carries the person who acted rather than the
   * literal "System" it used to hold — the point of a trail is who did it.
   */
  private event(action: string, actor?: DealActor, type: 'auto' | 'pc' | 'pm' = 'auto') {
    const date = new Date().toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    return { date, action, role: actor?.name || 'System', type, by: actor?.id || '' };
  }

  /**
   * Turn an approved lead into a project.
   *
   * Everything captured during intake travels with it, and the deal is
   * archived rather than deleted -- the board stops carrying the card, but its
   * audit trail survives and stays reachable from the project via `leadId`.
   */
  async convertToProject(id: string, opts: { stage?: string; name?: string; contractAmt?: string }, actor?: DealActor) {
    const deal = await this.findOne(id);
    if (deal.convertedProjectId) {
      throw new BadRequestException(`${deal.name} was already converted to project ${deal.convertedProjectId}.`);
    }

    // The lead shares the deal's id -- that is how intake and board are linked.
    const lead = await this.leads.findOneBy({ id });

    const location = [lead?.projectCity, lead?.countyLocation].filter(Boolean).join(', ')
      || [lead?.projectStreetAddress, lead?.projectStreetName].filter(Boolean).join(' ');

    const project = await this.projects.create({
      name: opts.name?.trim() || deal.name,
      stage: opts.stage || 'Design',
      contractAmt: opts.contractAmt?.trim() || deal.value || '$0',
      location,
      typeOfWork: lead?.potentialProjectType || '',
      contractType: lead?.contractType || '',
      scope: lead?.projectVision || deal.notes || '',
      estStart: lead?.desiredStart || '',
      referral: lead?.leadSource || deal.source || '',
      contactedBy: deal.assignee || '',
      leadId: id,
      priority: 'Medium',
      progress: 0,
    });

    deal.convertedProjectId = Number(project.id);
    deal.archived = true;
    deal.archivedAt = new Date().toISOString();
    deal.timeline = [
      ...((deal.timeline as unknown[]) || []),
      this.event(`Converted to project #${project.id} (${project.stage}) — card archived`, actor),
    ];
    await this.repo.save(deal);

    return { project, deal };
  }

  // Idempotent: succeeds even if the deal is already gone.
  async remove(id: string) {
    const deal = await this.repo.findOneBy({ id });
    if (deal) await this.repo.remove(deal);
    return { id, deleted: true };
  }
}

/** Initials for the little avatar on a card. */
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

/** Month arithmetic that clamps rather than rolling over (31 Jan + 1mo = 28 Feb). */
function addMonths(from: Date, months: number) {
  const day = from.getDate();
  const out = new Date(from.getTime());
  out.setDate(1);
  out.setMonth(out.getMonth() + months);
  const lastDay = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(day, lastDay));
  return out;
}
