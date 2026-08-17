import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplateEntity } from '../database/entities';
import { DEFAULT_EMAIL_TEMPLATES } from '../seed-data/email-templates';

@Injectable()
export class EmailTemplatesService implements OnApplicationBootstrap {
  private readonly log = new Logger('EmailTemplatesService');

  constructor(
    @InjectRepository(EmailTemplateEntity) private readonly repo: Repository<EmailTemplateEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_EMAIL_TEMPLATES as unknown as EmailTemplateEntity[]);
        this.log.log(`Seeded ${DEFAULT_EMAIL_TEMPLATES.length} email templates`);
      }
    } catch (err) {
      this.log.error('Email template seed failed: ' + (err as Error).message);
    }
  }

  findAll() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  findOne(id: string) {
    return this.repo.findOneBy({ id });
  }

  create(dto: any) {
    const id = dto.id || 'TPL-' + String(Date.now());
    const tpl = { key: '', subject: '', kind: 'email', category: '', updatedAt: new Date().toISOString(), ...dto, id };
    return this.repo.save(this.repo.create(tpl as Partial<EmailTemplateEntity>));
  }

  async update(id: string, dto: any) {
    let tpl = await this.repo.findOneBy({ id });
    if (!tpl) tpl = this.repo.create({ id } as Partial<EmailTemplateEntity>);
    Object.assign(tpl, dto, { id, updatedAt: new Date().toISOString() });
    return this.repo.save(tpl);
  }

  async remove(id: string) {
    const tpl = await this.repo.findOneBy({ id });
    if (tpl) await this.repo.remove(tpl);
    return { id, deleted: true };
  }
}
