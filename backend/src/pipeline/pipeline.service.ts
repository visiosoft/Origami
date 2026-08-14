import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DealEntity } from '../database/entities';
import { STAGES, DEALS } from '../seed-data/pipeline';

@Injectable()
export class PipelineService {
  private mem: any[] = [...DEALS];

  constructor(
    @Optional() @InjectRepository(DealEntity) private readonly repo?: Repository<DealEntity>,
  ) {}

  getStages() {
    return STAGES;
  }

  findAll() {
    return this.repo ? this.repo.find() : this.mem;
  }

  async findOne(id: string) {
    const deal = this.repo ? await this.repo.findOneBy({ id }) : this.mem.find((d) => d.id === id);
    if (!deal) throw new NotFoundException(`Deal ${id} not found`);
    return deal;
  }

  create(dto: any) {
    if (this.repo) return this.repo.save(this.repo.create(dto as Partial<DealEntity>));
    this.mem = [dto, ...this.mem];
    return dto;
  }

  async updateStage(id: string, stage: string) {
    // Keep stageIdx in sync with the canonical stage order so the progress bar
    // and "Advance" logic stay correct after a reload.
    const idx = STAGES.findIndex((s) => s.key === stage);
    const stageName = idx >= 0 ? STAGES[idx].name : stage;
    const when = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const entry = { date: when, action: `Moved to ${stageName}`, role: 'System', type: 'auto' };
    if (this.repo) {
      const deal = await this.findOne(id);
      deal.stage = stage;
      if (idx >= 0) deal.stageIdx = idx;
      deal.timeline = [...((deal.timeline as unknown[]) || []), entry];
      return this.repo.save(deal);
    }
    const deal = this.mem.find((d) => d.id === id);
    if (!deal) throw new NotFoundException(`Deal ${id} not found`);
    deal.stage = stage;
    if (idx >= 0) deal.stageIdx = idx;
    deal.timeline = [...(deal.timeline || []), entry];
    return deal;
  }

  // Idempotent: succeeds even if the deal is already gone, so best-effort
  // deletes from the UI never surface a 404.
  async remove(id: string) {
    if (this.repo) {
      const deal = this.repo ? await this.repo.findOneBy({ id }) : null;
      if (deal) await this.repo.remove(deal);
      return { id, deleted: true };
    }
    this.mem = this.mem.filter((d) => d.id !== id);
    return { id, deleted: true };
  }
}
