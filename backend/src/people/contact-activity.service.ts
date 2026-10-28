import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { ContactInteractionEntity, ContractorBidEntity, PersonEntity } from '../database/entities';
import { contactAlerts } from './contact-alerts';
import { AUTO_REVIEW_REASON } from './contact-status';

export const INTERACTION_KINDS = ['call', 'email', 'meeting', 'site_visit', 'note'] as const;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const latest = (...xs: (string | null | undefined)[]) => xs.filter(Boolean).sort().pop() || null;
const companyKey = (p: Pick<PersonEntity, 'company' | 'name' | 'kind'>) => String(['Consultant', 'Sub', 'Authority', 'Vendor'].includes(p.kind) ? p.name : p.company || '').trim().toLowerCase();

/**
 * A contact's Activity (Oct 27 backlog): interactions logged by hand, their
 * RFPs and estimates (subs), the point of contact for their company, and the
 * responsiveness / interactions / pulse alerts worked out from those.
 */
@Injectable()
export class ContactActivityService {
  constructor(
    @InjectRepository(PersonEntity) private readonly people: Repository<PersonEntity>,
    @InjectRepository(ContactInteractionEntity) private readonly interactions: Repository<ContactInteractionEntity>,
    @InjectRepository(ContractorBidEntity) private readonly bids: Repository<ContractorBidEntity>,
  ) {}

  private async person(id: string | number) {
    const p = await this.people.findOneBy({ id: Number(id) });
    if (!p) throw new NotFoundException('Contact not found.');
    return p;
  }

  async activity(id: string, now = new Date()) {
    const p = await this.person(id);
    const [interactions, bids, all] = await Promise.all([
      this.interactions.find({ where: { personId: p.id }, order: { at: 'DESC', createdAt: 'DESC' } }),
      p.contractorId ? this.bids.find({ where: { contractorId: p.contractorId }, order: { dateReceived: 'DESC' } }) : Promise.resolve([]),
      this.people.find({ select: { id: true, name: true, company: true, kind: true, pointOfContact: true } }),
    ]);
    const key = companyKey(p);
    const poc = key ? all.find((x) => x.pointOfContact && companyKey(x) === key) : null;
    const lastInteractionAt = latest(p.lastActivityAt, interactions[0]?.at);
    return {
      interactions, bids, lastInteractionAt,
      alerts: contactAlerts({ bids, lastInteractionAt }, now),
      pointOfContact: poc ? { id: poc.id, name: poc.name } : null,
    };
  }

  async log(id: string, dto: { kind?: string; at?: string; note?: string }, actor: { id?: string; name?: string } | null) {
    const p = await this.person(id);
    const kind = String(dto?.kind || 'note');
    if (!(INTERACTION_KINDS as readonly string[]).includes(kind)) throw new BadRequestException('Pick call, email, meeting, site visit or note.');
    const at = String(dto?.at || new Date().toISOString()).slice(0, 10);
    if (!ISO.test(at)) throw new BadRequestException('When was it?');
    const note = String(dto?.note || '').trim().slice(0, 2000) || null;
    if (kind === 'note' && !note) throw new BadRequestException('Type the note.');
    const row = await this.interactions.save(this.interactions.create({ id: randomUUID(), personId: p.id, kind, at, note, byId: actor?.id || null, byName: actor?.name || null, createdAt: new Date().toISOString() }));
    // A real interaction is activity: it moves "last activity" and lifts an automatic 12-month Review.
    const atIso = new Date(at + 'T12:00:00Z').toISOString();
    if (!p.lastActivityAt || atIso > p.lastActivityAt) p.lastActivityAt = atIso;
    if (p.contactStatus === 'review' && p.contactStatusReason === AUTO_REVIEW_REASON) Object.assign(p, { contactStatus: 'active', contactStatusReason: null, contactStatusAt: new Date().toISOString() });
    await this.people.save(p);
    return row;
  }

  async removeInteraction(id: string, interactionId: string) {
    const row = await this.interactions.findOneBy({ id: interactionId, personId: Number(id) });
    if (!row) throw new NotFoundException('Not found.');
    await this.interactions.remove(row);
    return { deleted: true };
  }

  /** Make this person their company's point of contact (the one before stops being it), or stop. */
  async setPointOfContact(id: string, on: boolean) {
    const p = await this.person(id);
    const key = companyKey(p);
    if (on && !key) throw new BadRequestException('Add their company first.');
    if (on) {
      const others = (await this.people.find()).filter((x) => x.id !== p.id && x.pointOfContact && companyKey(x) === key);
      for (const o of others) o.pointOfContact = false;
      if (others.length) await this.people.save(others);
    }
    p.pointOfContact = on;
    return this.people.save(p);
  }
}
