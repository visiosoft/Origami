import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DealEntity } from '../database/entities';
import { STAGES } from '../seed-data/pipeline';

/** Who performed an action, for the audit trail. */
export interface DealActor { name: string; id?: string }

@Injectable()
export class PipelineService implements OnApplicationBootstrap {
  private readonly log = new Logger('PipelineService');

  constructor(
    @InjectRepository(DealEntity) private readonly repo: Repository<DealEntity>,
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
      if (!stale.length) return;
      for (const deal of stale) deal.stageIdx = STAGES.findIndex((s) => s.key === deal.stage);
      await this.repo.save(stale);
      this.log.log(`Repaired stageIdx on ${stale.length} deal(s)`);
    } catch (err) {
      this.log.warn('Stage index repair failed: ' + (err as Error).message);
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
    deal.stage = stage;
    if (idx >= 0) deal.stageIdx = idx;

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

  // Idempotent: succeeds even if the deal is already gone.
  async remove(id: string) {
    const deal = await this.repo.findOneBy({ id });
    if (deal) await this.repo.remove(deal);
    return { id, deleted: true };
  }
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
