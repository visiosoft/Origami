import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactInteractionEntity, ContractorBidEntity, FileRoomShareEntity, PersonEntity, ProjectTaskEntity, TaskEntity } from '../database/entities';
import { alertStatus, contactAlerts } from './contact-alerts';
import { SettingsService } from '../settings/settings.service';
import { asDate, nextContactStatus } from './contact-status';

const HOUR = 60 * 60 * 1000;
const latest = (...xs: (string | null | undefined)[]) => xs.filter(Boolean).sort().pop() || null;

/**
 * Once a day: work out each contact's latest activity (their own record, tasks
 * assigned to them, files sent to them) and move anyone quiet for 12 months to
 * Review. Expired contacts are left alone.
 */
@Injectable()
export class ContactStatusService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('ContactStatus');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(PersonEntity) private readonly people: Repository<PersonEntity>,
    @InjectRepository(TaskEntity) private readonly logTasks: Repository<TaskEntity>,
    @InjectRepository(ProjectTaskEntity) private readonly boardTasks: Repository<ProjectTaskEntity>,
    @InjectRepository(FileRoomShareEntity) private readonly shares: Repository<FileRoomShareEntity>,
    private readonly settings: SettingsService,
    @Optional() @InjectRepository(ContractorBidEntity) private readonly bids?: Repository<ContractorBidEntity>,
    @Optional() @InjectRepository(ContactInteractionEntity) private readonly interactions?: Repository<ContactInteractionEntity>,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => { void this.tick(); }, HOUR);
    this.timer.unref?.();
    setTimeout(() => { void this.tick(); }, 120_000).unref?.();
  }

  onApplicationShutdown() { if (this.timer) clearInterval(this.timer); }

  async tick() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      if ((await this.settings.get('people.statusRunDate')) === today) return;
      await this.settings.set('people.statusRunDate', today);
      const r = await this.sweep(new Date());
      if (r.review || r.active) this.log.log(`Contacts: ${r.review} moved to Review, ${r.active} back to Active`);
    } catch (e) {
      this.log.error('Contact status check failed: ' + (e as Error).message);
    }
  }

  async sweep(now: Date) {
    const [people, logs, boards, shares, bids, interactions] = await Promise.all([
      this.people.find(), this.logTasks.find(), this.boardTasks.find(), this.shares.find(),
      this.bids ? this.bids.find() : Promise.resolve([]), this.interactions ? this.interactions.find() : Promise.resolve([]),
    ]);
    const bidsBy = new Map<string, ContractorBidEntity[]>();
    for (const b of bids) bidsBy.set(b.contractorId, [...(bidsBy.get(b.contractorId) || []), b]);
    const talkedBy = new Map<number, string>();
    for (const i of interactions) { const d = asDate(i.at); if (d && (!talkedBy.has(i.personId) || talkedBy.get(i.personId)! < d)) talkedBy.set(i.personId, d); }
    // Latest activity by user id, by name and by email.
    const byKey = new Map<string, string>();
    const bump = (k: string | null | undefined, at: string | null | undefined) => {
      const key = String(k || '').trim().toLowerCase();
      const d = asDate(at);
      if (!key || !d) return;
      if (!byKey.has(key) || byKey.get(key)! < d) byKey.set(key, d);
    };
    for (const t of logs) { const at = t.updatedAt || t.meetingDate; bump(t.assignedToId, at); bump(t.assignedTo, at); }
    for (const t of boards) { const at = t.updatedAt || t.createdAt; bump(t.assigneeId, at); bump(t.assignee, at); }
    for (const s of shares) for (const to of String(s.to || '').split(',')) bump(to, s.sentAt);

    let review = 0, active = 0;
    const stamp = now.toISOString();
    for (const p of people) {
      const found = latest(p.lastActivityAt, talkedBy.get(p.id), byKey.get(String(p.userId || '').toLowerCase()), byKey.get(p.name.trim().toLowerCase()), byKey.get(String(p.email || '').trim().toLowerCase()));
      // Nothing on record yet: start the clock today rather than guess.
      const last = found || asDate(p.since) || stamp;
      // The 12-month rule first; then the Activity alerts (RFP responsiveness, proposals without an award).
      const next = nextContactStatus(p, last, now)
        ?? alertStatus(p, contactAlerts({ bids: p.contractorId ? bidsBy.get(p.contractorId) || [] : [], lastInteractionAt: last }, now));
      if (!next && last === p.lastActivityAt) continue;
      Object.assign(p, { lastActivityAt: last }, next ? { ...next, contactStatusAt: stamp } : {});
      await this.people.save(p);
      if (next?.contactStatus === 'review') review++;
      if (next?.contactStatus === 'active') active++;
    }
    return { review, active };
  }
}
