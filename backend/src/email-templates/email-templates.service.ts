import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplateEntity } from '../database/entities';
import { DEFAULT_EMAIL_TEMPLATES, LEGACY_INTRODUCTION_LETTER_BODY_V1, LEGACY_INTRODUCTION_LETTER_BODY_V2, LEGACY_INTRODUCTION_LETTER_BODY_V3 } from '../seed-data/email-templates';

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
      // The Introduction Letter moved from the generic 'email' kind to its own
      // 'introduction' kind (its own Library tab) -- an install seeded before
      // that change would otherwise keep the stale kind forever.
      const intro = await this.repo.findOneBy({ id: 'TPL-introduction-letter' });
      if (intro && intro.kind !== 'introduction') {
        intro.kind = 'introduction';
        await this.repo.save(intro);
        this.log.log('Moved Introduction Letter template to the introduction kind');
      }
      // Bring the wording up to the office's exact reference letter -- but
      // only for an install that still has the earlier placeholder body
      // verbatim, or an emptied-out one (e.g. cleared while testing).
      // An install where someone already wrote real content is left alone.
      const legacyIntroBodies = [LEGACY_INTRODUCTION_LETTER_BODY_V1, LEGACY_INTRODUCTION_LETTER_BODY_V2, LEGACY_INTRODUCTION_LETTER_BODY_V3];
      if (intro && (legacyIntroBodies.includes(intro.body) || !intro.body || !intro.body.trim())) {
        intro.body = DEFAULT_EMAIL_TEMPLATES.find((t) => t.id === 'TPL-introduction-letter')!.body;
        await this.repo.save(intro);
        this.log.log('Updated Introduction Letter template body to the reference wording');
      }
      // A stray blank "introduction" row (e.g. from "+ New Template" clicked
      // by mistake before that button was hidden) left behind once a real,
      // populated one also exists is just clutter -- clean it up. Never
      // removes the last one, even if it's the empty placeholder itself.
      const introRows = (await this.repo.find()).filter((t) => t.kind === 'introduction');
      if (introRows.length > 1) {
        const populated = introRows.filter((t) => t.body && t.body.trim());
        const empties = introRows.filter((t) => !t.body || !t.body.trim());
        if (populated.length && empties.length) {
          await this.repo.remove(empties);
          this.log.log(`Removed ${empties.length} empty Introduction Letter placeholder(s)`);
        }
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
