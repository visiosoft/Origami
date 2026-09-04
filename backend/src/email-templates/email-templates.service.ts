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
      // Top up rather than seed-once: a database created before a template
      // existed would otherwise never receive it, which is what happened when
      // the SMS templates were added to an already-seeded install. Only
      // missing ids are inserted, so edits to existing templates are safe.
      const existing = new Set((await this.repo.find()).map((t) => t.id));
      const missing = DEFAULT_EMAIL_TEMPLATES.filter((t) => !existing.has(t.id));
      if (missing.length) {
        await this.repo.save(missing as unknown as EmailTemplateEntity[]);
        this.log.log(`Seeded ${missing.length} template(s)`);
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
