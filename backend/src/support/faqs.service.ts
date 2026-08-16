import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FaqEntity } from '../database/entities';
import { DEFAULT_FAQS } from '../seed-data/support';

@Injectable()
export class FaqsService implements OnApplicationBootstrap {
  private readonly log = new Logger('FaqsService');

  constructor(
    @InjectRepository(FaqEntity) private readonly repo: Repository<FaqEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_FAQS as unknown as FaqEntity[]);
        this.log.log(`Seeded ${DEFAULT_FAQS.length} FAQs`);
      }
    } catch (err) {
      this.log.error('FAQ seed failed: ' + (err as Error).message);
    }
  }

  findAll() {
    return this.repo.find({ order: { order: 'ASC' } });
  }

  create(dto: any) {
    const id = dto.id || 'FAQ-' + String(Date.now());
    const faq = { order: 999, category: '', ...dto, id };
    return this.repo.save(this.repo.create(faq as Partial<FaqEntity>));
  }

  async update(id: string, dto: any) {
    let faq = await this.repo.findOneBy({ id });
    if (!faq) faq = this.repo.create({ id } as Partial<FaqEntity>);
    Object.assign(faq, dto, { id });
    return this.repo.save(faq);
  }

  async remove(id: string) {
    const faq = await this.repo.findOneBy({ id });
    if (faq) await this.repo.remove(faq);
    return { id, deleted: true };
  }
}
