import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { LeadEntity, PersonEntity, SmsBatchEntity } from '../database/entities';
import { SmsLogService } from './sms-log.service';
import { SmsService, normalizeNumber } from './sms.service';

export type Pick = { people?: (number | string)[]; leads?: string[] };
type Recipient = SmsBatchEntity['recipients'][number];

/** {first name} / {name} in a mass text, per person. */
export function personalise(body: string, name: string) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  return String(body || '').replace(/\{\s*first\s*name\s*\}/gi, first || 'there').replace(/\{\s*name\s*\}/gi, name || 'there');
}

/**
 * Mass texts (Nov 13 sync): one message to many people, each sent on its own
 * (never a group thread), one every couple of seconds, skipping people with
 * no number or who opted out. Every text is logged against the person or lead.
 */
@Injectable()
export class MassTextsService {
  private readonly log = new Logger('MassTexts');
  static GAP_MS = 1500;
  /** Batches being sent by this server, so one is never sent twice at once. */
  private readonly running = new Set<string>();

  constructor(
    private readonly sms: SmsService,
    private readonly texts: SmsLogService,
    @InjectRepository(SmsBatchEntity) private readonly batches: Repository<SmsBatchEntity>,
    @InjectRepository(PersonEntity) private readonly people: Repository<PersonEntity>,
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
  ) {}

  /** Who would get it, and who is skipped and why. */
  async preview(pick: Pick): Promise<Recipient[]> {
    const ids = (pick.people || []).map(Number).filter(Number.isFinite);
    const people = ids.length ? await this.people.findBy({ id: In(ids) } as any) : [];
    const leads = pick.leads?.length ? await this.leads.findBy({ id: In(pick.leads.map(String)) }) : [];
    const rows: Recipient[] = [
      ...people.map((p) => ({ type: 'person' as const, id: String(p.id), name: p.name, phone: normalizeNumber(String(p.phone || '').replace(/^—$/, '')) })),
      ...leads.map((l) => ({ type: 'lead' as const, id: l.id, name: l.goByName || [l.firstName, l.lastName].filter(Boolean).join(' ') || l.leadName, phone: normalizeNumber(l.phone || '') })),
    ].map((r) => ({ ...r, status: 'waiting' as const }));
    const seen = new Set<string>();
    for (const r of rows) {
      if (!r.phone || r.phone.length < 8) Object.assign(r, { status: 'skipped', note: 'No phone number' });
      else if (seen.has(r.phone)) Object.assign(r, { status: 'skipped', note: 'Same number as someone above' });
      else if (await this.sms.isBlocked(r.phone, 'announcements')) Object.assign(r, { status: 'skipped', note: 'Opted out' });
      seen.add(r.phone);
    }
    return rows;
  }

  async start(pick: Pick, body: string, by: { id?: string; name?: string } | null) {
    const text = String(body || '').trim();
    if (!text) throw new BadRequestException('Write the message first.');
    if (text.length > 1000) throw new BadRequestException('Keep it under 1,000 characters.');
    const recipients = await this.preview(pick);
    if (!recipients.some((r) => r.status === 'waiting')) throw new BadRequestException('Nobody on the list can get a text.');
    if (recipients.length > 500) throw new BadRequestException('Up to 500 people at a time.');
    const batch = await this.batches.save({ id: 'MT-' + randomUUID(), at: new Date().toISOString(), body: text, byId: by?.id || null, byName: by?.name || null, status: 'sending', recipients });
    void this.run(batch.id, by).catch((e: Error) => this.log.warn(`Mass text ${batch.id} stopped: ${e.message}`));
    return batch;
  }

  /** Send one at a time, saving progress, so a restart can be seen (and the rest re-sent by hand). */
  async run(id: string, by: { id?: string; name?: string } | null, gap = MassTextsService.GAP_MS) {
    if (this.running.has(id)) return;
    this.running.add(id);
    try { await this.sendAll(id, by, gap); } finally { this.running.delete(id); }
  }

  private async sendAll(id: string, by: { id?: string; name?: string } | null, gap: number) {
    const batch = await this.batches.findOneBy({ id });
    if (!batch) return;
    for (const r of batch.recipients) {
      if (r.status !== 'waiting') continue;
      const fresh = await this.batches.findOneBy({ id });
      if (fresh?.status === 'stopped') return;
      try {
        await this.texts.send({ to: r.phone, body: personalise(batch.body, r.name), entityType: r.type, entityId: r.id, category: 'announcements', templateKey: 'mass:' + id }, by);
        r.status = 'sent';
      } catch (e) {
        r.status = /opted out/i.test((e as Error).message) ? 'skipped' : 'failed';
        r.note = (e as Error).message.slice(0, 200);
      }
      await this.batches.update({ id }, { recipients: batch.recipients });
      if (gap) await new Promise((res) => setTimeout(res, gap));
    }
    await this.batches.update({ id }, { status: 'done', recipients: batch.recipients });
  }

  async stop(id: string) {
    const b = await this.batches.findOneBy({ id });
    if (!b) throw new NotFoundException('Not found.');
    if (b.status === 'sending') await this.batches.update({ id }, { status: 'stopped' });
    return this.get(id);
  }

  async get(id: string) {
    const b = await this.batches.findOneBy({ id });
    if (!b) throw new NotFoundException('Not found.');
    const count = (s: string) => b.recipients.filter((r) => r.status === s).length;
    return { ...b, sent: count('sent'), failed: count('failed'), skipped: count('skipped'), waiting: count('waiting') };
  }

  async list() {
    const rows = await this.batches.find({ order: { at: 'DESC' }, take: 30 });
    return rows.map((b) => ({ id: b.id, at: b.at, body: b.body, byName: b.byName, status: b.status, total: b.recipients.length, sent: b.recipients.filter((r) => r.status === 'sent').length }));
  }
}
