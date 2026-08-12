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
    return STAGES;
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
    const deal = await this.findOne(id);
    deal.stage = stage;
    return this.repo.save(deal);
  }
}
