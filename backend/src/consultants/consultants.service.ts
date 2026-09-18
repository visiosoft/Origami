import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsultantEntity } from '../database/entities';
import { DEFAULT_CONSULTANTS } from '../seed-data/consultants';

@Injectable()
export class ConsultantsService implements OnApplicationBootstrap {
  private readonly log = new Logger('ConsultantsService');

  constructor(
    @InjectRepository(ConsultantEntity) private readonly repo: Repository<ConsultantEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_CONSULTANTS as ConsultantEntity[]);
        this.log.log(`Seeded ${DEFAULT_CONSULTANTS.length} consultants from the matrix`);
      }
    } catch (err) {
      this.log.error('Consultant seed failed: ' + (err as Error).message);
    }
  }

  findAll() {
    return this.repo.find({ order: { type: 'ASC', firm: 'ASC' } });
  }

  create(dto: Partial<ConsultantEntity>) {
    const id = dto.id || 'CONS-' + String(Date.now());
    const consultant = { type: '', firm: '', ...dto, id };
    return this.repo.save(this.repo.create(consultant as Partial<ConsultantEntity>));
  }

  async update(id: string, dto: Partial<ConsultantEntity>) {
    let consultant = await this.repo.findOneBy({ id });
    if (!consultant) consultant = this.repo.create({ id } as Partial<ConsultantEntity>);
    Object.assign(consultant, dto, { id });
    return this.repo.save(consultant);
  }

  async remove(id: string) {
    const consultant = await this.repo.findOneBy({ id });
    if (consultant) await this.repo.remove(consultant);
    return { id, deleted: true };
  }
}
