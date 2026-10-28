import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { TrackedLinkEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { NotifyHub } from '../notifications/notify-hub.service';
import { recordHit } from './open-rules';

export const TRACKED_KINDS = ['co', 'share'];
export interface OpenSummary { firstOpenedAt: string | null; lastOpenedAt: string | null; opens: number }

/** Tracked links in outgoing email (Oct 27 backlog item 12). */
@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(TrackedLinkEntity) private readonly repo: Repository<TrackedLinkEntity>,
    private readonly settings: SettingsService,
    @Optional() private readonly hub?: NotifyHub,
  ) {}

  /** A tracked URL for `target`: put this in the email instead of the target itself. */
  async link(o: { kind: string; refId: string; target: string; recipient?: string; projectId?: number | null; label?: string }) {
    const token = randomBytes(16).toString('base64url');
    await this.repo.save({
      token, kind: o.kind, refId: String(o.refId), target: o.target, recipient: o.recipient || null, projectId: o.projectId ?? null,
      label: o.label ? o.label.slice(0, 300) : null, createdAt: new Date().toISOString(), opens: 0, scannerHits: 0,
    } as TrackedLinkEntity);
    return `${(await this.settings.baseUrl()) || ''}/api/d/${token}`;
  }

  /** Count a hit and say where to send the browser; null if the link isn't ours. */
  async open(token: string, userAgent?: string, now = new Date()): Promise<string | null> {
    const row = await this.repo.findOneBy({ token: String(token || '').slice(0, 64) });
    if (!row) return null;
    const first = !row.firstOpenedAt;
    const kind = recordHit(row, now, userAgent);
    await this.repo.save(row);
    if (kind === 'open' && first && this.hub) {
      const who = row.recipient || 'The client';
      void this.hub.broadcast('lead_status', { title: `${who} opened ${row.label || (row.kind === 'co' ? 'the change order' : 'the shared file')}`, path: row.kind === 'co' ? '/changeorders' : '/planroom' });
    }
    return row.target;
  }

  /** Per record: when its links were first and last opened, and how often (people, not scanners). */
  async summary(kind: string, refIds: string[]): Promise<Record<string, OpenSummary>> {
    const ids = [...new Set(refIds.map(String))].filter(Boolean);
    if (!ids.length || !TRACKED_KINDS.includes(kind)) return {};
    const rows = await this.repo.find({ where: { kind, refId: In(ids) } });
    const out: Record<string, OpenSummary> = {};
    for (const r of rows) {
      const s = (out[r.refId] ||= { firstOpenedAt: null, lastOpenedAt: null, opens: 0 });
      s.opens += r.opens || 0;
      if (r.firstOpenedAt && (!s.firstOpenedAt || r.firstOpenedAt < s.firstOpenedAt)) s.firstOpenedAt = r.firstOpenedAt;
      if (r.lastOpenedAt && (!s.lastOpenedAt || r.lastOpenedAt > s.lastOpenedAt)) s.lastOpenedAt = r.lastOpenedAt;
    }
    return out;
  }

  /** The tracked links for one change order or share, newest first. */
  forRef(kind: string, refId: string) {
    if (!TRACKED_KINDS.includes(kind)) return Promise.resolve([]);
    return this.repo.find({ where: { kind, refId: String(refId) }, order: { createdAt: 'DESC' }, take: 50 })
      .then((rows) => rows.map(({ token: _t, target: _g, lastUserAgent: _u, ...r }) => r));
  }
}
