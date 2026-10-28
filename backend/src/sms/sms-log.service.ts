import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { SmsMessageEntity } from '../database/entities';
import { SmsService } from './sms.service';

export const SMS_ENTITY_TYPES = ['lead', 'person', 'project'];

export interface TextInput {
  to: string; body: string;
  entityType?: string; entityId?: string; templateKey?: string;
}

/**
 * "Text client" (Oct 27 backlog item 11): send through SmsService and keep a
 * record of every attempt -- sent or failed -- against the lead, contact or
 * project it was sent from.
 */
@Injectable()
export class SmsLogService {
  constructor(
    private readonly sms: SmsService,
    @InjectRepository(SmsMessageEntity) private readonly repo: Repository<SmsMessageEntity>,
  ) {}

  async send(input: TextInput, by?: { id?: string; name?: string } | null) {
    const entityType = SMS_ENTITY_TYPES.includes(String(input.entityType || '')) ? String(input.entityType) : null;
    const row: SmsMessageEntity = {
      id: 'SMS-' + randomUUID(), at: new Date().toISOString(), to: String(input.to || '').slice(0, 32), body: String(input.body || '').trim().slice(0, 2000),
      provider: await this.sms.provider(), status: 'sent', error: null, providerId: null,
      entityType, entityId: entityType && input.entityId ? String(input.entityId).slice(0, 64) : null,
      templateKey: input.templateKey ? String(input.templateKey).slice(0, 100) : null,
      byId: by?.id || null, byName: by?.name || null,
    };
    try {
      const r = await this.sms.send({ to: input.to, body: input.body });
      row.to = r.to; row.providerId = r.sid ? String(r.sid).slice(0, 100) : null;
      await this.repo.save(row);
      return { ...r, message: row };
    } catch (e) {
      row.status = 'failed'; row.error = (e as Error).message.slice(0, 500);
      await this.repo.save(row).catch(() => undefined);
      throw e;
    }
  }

  /** A record's texts, newest first. */
  list(entityType: string, entityId: string) {
    if (!SMS_ENTITY_TYPES.includes(entityType) || !entityId) return Promise.resolve([]);
    return this.repo.find({ where: { entityType, entityId }, order: { at: 'DESC' }, take: 100 });
  }
}
