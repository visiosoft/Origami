import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DealEntity } from '../database/entities';
import { STAGES } from '../seed-data/pipeline';

@Injectable()
export class PipelineService {
  constructor(
    @InjectRepository(DealEntity) private readonly repo: Repository<DealEntity>,
  ) {}

  getStages() {
    return STAGES; // stage definitions are static config, not row data
  }

  findAll() {
    return this.repo.find();
  }

  async findOne(id: string) {
    const deal = await this.repo.findOneBy({ id });
    if (!deal) throw new NotFoundException(`Deal ${id} not found`);
    return deal;
  }

  create(dto: any) {
    return this.repo.save(this.repo.create(dto as Partial<DealEntity>));
  }

  async updateStage(id: string, stage: string) {
    // Keep stageIdx in sync with the canonical stage order so the progress bar
    // and "Advance" logic stay correct after a reload; log the move to timeline.
    const idx = STAGES.findIndex((s) => s.key === stage);
    const stageName = idx >= 0 ? STAGES[idx].name : stage;
    const when = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const entry = { date: when, action: `Moved to ${stageName}`, role: 'System', type: 'auto' };
    const deal = await this.findOne(id);
    deal.stage = stage;
    if (idx >= 0) deal.stageIdx = idx;
    deal.timeline = [...((deal.timeline as unknown[]) || []), entry];
    return this.repo.save(deal);
  }

  // Idempotent: succeeds even if the deal is already gone.
  async remove(id: string) {
    const deal = await this.repo.findOneBy({ id });
    if (deal) await this.repo.remove(deal);
    return { id, deleted: true };
  }
}
