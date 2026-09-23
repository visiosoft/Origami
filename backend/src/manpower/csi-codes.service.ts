import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CsiCodeEntity } from '../database/entities';
import { DEFAULT_CSI_CODES } from '../seed-data/csi-codes';

@Injectable()
export class CsiCodesService implements OnApplicationBootstrap {
  private readonly log = new Logger('CsiCodesService');

  constructor(
    @InjectRepository(CsiCodeEntity) private readonly repo: Repository<CsiCodeEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_CSI_CODES as unknown as CsiCodeEntity[]);
        this.log.log(`Seeded ${DEFAULT_CSI_CODES.length} CSI codes`);
      }
    } catch (err) {
      this.log.error('CSI code seed failed: ' + (err as Error).message);
    }
  }

  findAll() {
    return this.repo.find({ order: { order: 'ASC' } });
  }

  create(dto: any) {
    const id = dto.id || 'CSI-' + String(Date.now());
    const csiCode = { active: true, order: 0, ...dto, id };
    return this.repo.save(this.repo.create(csiCode as Partial<CsiCodeEntity>));
  }

  async update(id: string, dto: any) {
    const csiCode = await this.repo.findOneBy({ id });
    if (!csiCode) throw new NotFoundException(`CSI code ${id} not found`);
    Object.assign(csiCode, dto, { id });
    return this.repo.save(csiCode);
  }

  async remove(id: string) {
    const csiCode = await this.repo.findOneBy({ id });
    if (csiCode) await this.repo.remove(csiCode);
    return { id, deleted: true };
  }
}
