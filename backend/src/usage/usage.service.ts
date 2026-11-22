import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ApiUsageEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService } from '../google/google.service';
import { alertAdmins } from '../common/admin-alert';
import { cleanCredits, isOutOfCredit, monthOf, SERVICE_LABEL, SERVICES, standing, UNIT_LABEL, type Credits, type Service } from './usage';

const KEY_CREDITS = 'usage.credits';

/**
 * Nov 20 (Weekly Sync: "monitor API usage ... to prevent unexpected service
 * interruptions"): counts every text and AI call Origami makes, per month, and
 * emails the admins when a loaded credit is 80% used or a provider refuses for
 * lack of credit -- at most once a day per service and reason.
 */
@Injectable()
export class UsageService {
  private readonly log = new Logger('Usage');

  constructor(
    @InjectRepository(ApiUsageEntity) private readonly repo: Repository<ApiUsageEntity>,
    private readonly settings: SettingsService,
    private readonly data: DataSource,
    @Optional() private readonly google?: GoogleService,
  ) {}

  /** Never throws: counting must not stop a text from going out. */
  async record(service: Service, units: number, ok = true, error?: string, now = new Date()) {
    try {
      const month = monthOf(now);
      const id = `${service}|${month}`;
      const row = (await this.repo.findOneBy({ id })) || this.repo.create({ id, service, month, units: 0, calls: 0, failures: 0, lastError: null });
      row.calls += 1;
      if (ok) row.units += Math.max(0, Math.round(units || 0));
      else { row.failures += 1; row.lastError = String(error || '').slice(0, 500) || null; }
      row.updatedAt = now.toISOString();
      await this.repo.save(row);
      await this.check(service, ok ? null : error || null, now);
    } catch (e) { this.log.warn(`Usage not recorded: ${(e as Error).message}`); }
  }

  async credits(): Promise<Credits> {
    try { return cleanCredits(JSON.parse((await this.settings.get(KEY_CREDITS)) || '{}')); } catch { return {}; }
  }

  async setCredits(raw: unknown) {
    await this.settings.set(KEY_CREDITS, JSON.stringify(cleanCredits(raw)));
    return this.status();
  }

  private async usedSince(service: Service, since: string): Promise<number> {
    const from = since.slice(0, 7);
    return (await this.repo.find({ where: { service } })).filter((r) => r.month >= from).reduce((a, r) => a + (r.units || 0), 0);
  }

  async status(now = new Date()) {
    const credits = await this.credits();
    const rows = await this.repo.find();
    const month = monthOf(now);
    const services = [];
    for (const s of SERVICES) {
      const mine = rows.filter((r) => r.service === s);
      const thisMonth = mine.find((r) => r.month === month);
      const credit = credits[s];
      const st = standing(credit, credit ? await this.usedSince(s, credit.since) : 0, now);
      services.push({
        service: s, label: SERVICE_LABEL[s], unit: UNIT_LABEL[s], credit: credit || null,
        thisMonth: { units: thisMonth?.units || 0, calls: thisMonth?.calls || 0, failures: thisMonth?.failures || 0 },
        lastError: thisMonth?.lastError || null,
        months: mine.sort((a, b) => b.month.localeCompare(a.month)).slice(0, 6).map((r) => ({ month: r.month, units: r.units, calls: r.calls, failures: r.failures })),
        ...st,
      });
    }
    return { services };
  }

  /** Warn the admins: 80% of the credit used, or a provider refusing for lack of credit. */
  private async check(service: Service, error: string | null, now: Date) {
    const today = now.toISOString().slice(0, 10);
    const deps = { data: this.data, settings: this.settings, google: this.google };
    if (error && isOutOfCredit(error)) {
      await alertAdmins(deps, `usage.alert.${service}.out`, today, `${SERVICE_LABEL[service]} refused — out of credit`, [
        `${SERVICE_LABEL[service]} just refused a request for lack of credit: ${error}`,
        'Add credit with the provider, then update the amount in Settings → Integrations → Usage & credits.',
      ]);
      return;
    }
    const credit = (await this.credits())[service];
    if (!credit) return;
    const st = standing(credit, await this.usedSince(service, credit.since), now);
    if (st.level === 'low' || st.level === 'out') {
      await alertAdmins(deps, `usage.alert.${service}.low`, today, `${SERVICE_LABEL[service]} credit ${st.level === 'out' ? 'used up' : 'running low'}`, [
        `${SERVICE_LABEL[service]}: ${st.used.toLocaleString('en-US')} of ${credit.units.toLocaleString('en-US')} ${UNIT_LABEL[service]} used since ${credit.since} (${Math.round((st.share || 0) * 100)}%).`,
        st.daysLeft != null ? `At the current rate that's about ${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'} left.` : '',
        'Add credit with the provider, then update the amount in Settings → Integrations → Usage & credits.',
      ].filter(Boolean));
    }
  }
}
