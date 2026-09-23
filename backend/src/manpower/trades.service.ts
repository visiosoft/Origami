import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeEntity } from '../database/entities';
import { DEFAULT_TRADES } from '../seed-data/trades';

@Injectable()
export class TradesService implements OnApplicationBootstrap {
  private readonly log = new Logger('TradesService');

  constructor(@InjectRepository(TradeEntity) private readonly repo: Repository<TradeEntity>) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_TRADES as unknown as TradeEntity[]);
        this.log.log(`Seeded ${DEFAULT_TRADES.length} trades`);
      }
    } catch (err) {
      this.log.error('Trade seed failed: ' + (err as Error).message);
    }
  }

  findAll() {
    return this.repo.find({ order: { order: 'ASC' } });
  }

  create(dto: any) {
    const id = dto.id || 'TRD-' + String(Date.now());
    return this.repo.save(this.repo.create({ active: true, order: 0, ...dto, id } as Partial<TradeEntity>));
  }

  async update(id: string, dto: any) {
    const trade = await this.repo.findOneBy({ id });
    if (!trade) throw new NotFoundException(`Trade ${id} not found`);
    Object.assign(trade, dto, { id });
    return this.repo.save(trade);
  }

  async remove(id: string) {
    const trade = await this.repo.findOneBy({ id });
    if (trade) await this.repo.remove(trade);
    return { id, deleted: true };
  }
}
