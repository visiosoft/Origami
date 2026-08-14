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
    if (this.repo) {
      const deal = await this.findOne(id);
      deal.stage = stage;
      return this.repo.save(deal);
    }
    const deal = this.mem.find((d) => d.id === id);
    if (!deal) throw new NotFoundException(`Deal ${id} not found`);
    deal.stage = stage;
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
