import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayComponentEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { DEFAULT_PAYROLL_SETTINGS, LEGACY_PAYROLL_SETTINGS, type PayrollSettings } from './payroll.calc';
import { newId } from './workforce.util';

const SETTINGS_KEY = 'payroll.settings';
const LOCALE_KEY = 'hr.locale';

type Component = Omit<PayComponentEntity, 'id' | 'order'>;
const c = (name: string, kind: 'earning' | 'deduction', calcType: string, defaultValue: number, category: string): Component =>
  ({ name, kind, calcType, defaultValue, appliesTo: 'all', category, active: true }) as Component;

/**
 * US pay components. FICA (Social Security 6.2%, Medicare 1.45%) applies to
 * everyone by default; federal and state withholding are set per employee from
 * their W-4 / state form, since the rate depends on filing status and pay.
 * Allowances are seeded at zero and only apply once an amount is set.
 */
export const US_COMPONENTS: Component[] = [
  c('Site allowance', 'earning', 'fixed', 0, 'allowance'),
  c('Per diem', 'earning', 'fixed', 0, 'allowance'),
  c('Tool allowance', 'earning', 'fixed', 0, 'allowance'),
  c('Vehicle / mileage allowance', 'earning', 'fixed', 0, 'allowance'),
  c('Federal income tax withholding', 'deduction', 'percent_gross', 0, 'tax'),
  c('Social Security (OASDI)', 'deduction', 'percent_gross', 6.2, 'social_security'),
  c('Medicare', 'deduction', 'percent_gross', 1.45, 'social_security'),
  c('State income tax', 'deduction', 'percent_gross', 0, 'tax'),
  c('State disability insurance (SDI)', 'deduction', 'percent_gross', 0, 'insurance'),
  c('401(k) contribution', 'deduction', 'percent_basic', 0, 'retirement'),
  c('Health insurance premium', 'deduction', 'fixed', 0, 'insurance'),
  c('Union dues', 'deduction', 'fixed', 0, 'other'),
];

/** The components this system first shipped with, by seeded id -> what each becomes for the US (null: retire it). */
const LEGACY_COMPONENTS: Record<string, { name: string; to: string | null }> = {
  'PC-01': { name: 'Site allowance', to: 'Site allowance' },
  'PC-02': { name: 'Travel allowance', to: 'Vehicle / mileage allowance' },
  'PC-03': { name: 'Food allowance', to: 'Per diem' },
  'PC-04': { name: 'Accommodation allowance', to: null },
  'PC-05': { name: 'Income tax', to: 'Federal income tax withholding' },
  'PC-06': { name: 'Social security (EOBI)', to: 'Social Security (OASDI)' },
  'PC-07': { name: 'Insurance', to: 'Health insurance premium' },
};

@Injectable()
export class PayrollSetupService implements OnApplicationBootstrap {
  private readonly log = new Logger('PayrollSetupService');

  constructor(
    @InjectRepository(PayComponentEntity) private readonly components: Repository<PayComponentEntity>,
    private readonly store: SettingsService,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.components.count()) === 0) {
        await this.components.save(US_COMPONENTS.map((x, i) => ({ ...x, id: 'PC-US-' + String(i + 1).padStart(2, '0'), order: i })) as PayComponentEntity[]);
        this.log.log(`Seeded ${US_COMPONENTS.length} pay components`);
      }
      await this.convertToUs();
    } catch (err) {
      this.log.error('Payroll setup failed: ' + (err as Error).message);
    }
  }

  /**
   * One-time switch of a setup made with the original defaults to US payroll:
   * currency, weekend and salary divisor, and the pay components. Only values
   * still at their original defaults change -- anything someone set is kept.
   */
  async convertToUs() {
    if ((await this.store.get(LOCALE_KEY)) === 'US') return;
    const raw = await this.store.get(SETTINGS_KEY);
    if (raw) {
      let saved: Partial<PayrollSettings> = {};
      try { saved = JSON.parse(raw); } catch { saved = {}; }
      const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
      const L = LEGACY_PAYROLL_SETTINGS, U = DEFAULT_PAYROLL_SETTINGS;
      if (saved.currency === L.currency) saved.currency = U.currency;
      if (same(saved.weekendDays, L.weekendDays)) saved.weekendDays = U.weekendDays;
      if (saved.monthDays === L.monthDays) saved.monthDays = U.monthDays;
      if (same(saved.otMultipliers, L.otMultipliers)) saved.otMultipliers = U.otMultipliers;
      await this.store.set(SETTINGS_KEY, JSON.stringify(saved));
    }
    const rows = await this.components.find();
    for (const r of rows) {
      const legacy = LEGACY_COMPONENTS[r.id];
      if (!legacy || r.name !== legacy.name) continue; // renamed by someone: theirs now
      if (legacy.to === null) { if (!r.defaultValue) r.active = false; continue; }
      const us = US_COMPONENTS.find((x) => x.name === legacy.to)!;
      Object.assign(r, { name: us.name, calcType: us.calcType, appliesTo: 'all', category: us.category, defaultValue: r.defaultValue || us.defaultValue });
    }
    let order = rows.length;
    const add = US_COMPONENTS.filter((x) => !rows.some((r) => r.name === x.name))
      .map((x) => this.components.create({ ...x, id: newId('PC'), order: order++ } as PayComponentEntity));
    await this.components.save([...rows, ...add]);
    await this.store.set(LOCALE_KEY, 'US');
    this.log.log(`Payroll set up for the US: ${add.length} component(s) added`);
  }

  async settings(): Promise<PayrollSettings> {
    const raw = await this.store.get(SETTINGS_KEY);
    let saved: Partial<PayrollSettings> = {};
    try { saved = raw ? JSON.parse(raw) : {}; } catch { saved = {}; }
    return {
      ...DEFAULT_PAYROLL_SETTINGS, ...saved,
      otMultipliers: { ...DEFAULT_PAYROLL_SETTINGS.otMultipliers, ...(saved.otMultipliers || {}) },
    };
  }

  async saveSettings(patch: Partial<PayrollSettings>): Promise<PayrollSettings> {
    const next = { ...(await this.settings()), ...patch, otMultipliers: { ...(await this.settings()).otMultipliers, ...(patch.otMultipliers || {}) } };
    const positive = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
    if (!positive(next.standardDayHours) || next.standardDayHours > 24) throw new BadRequestException('A working day must be between 0 and 24 hours.');
    if (!positive(next.halfDayHours) || next.halfDayHours > next.standardDayHours) throw new BadRequestException('A half day must be more than 0 and no longer than a full day.');
    if (!positive(next.monthDays) || next.monthDays > 31) throw new BadRequestException('Days per month must be between 1 and 31.');
    for (const [k, v] of Object.entries(next.otMultipliers)) if (!positive(v)) throw new BadRequestException(`The ${k} overtime multiplier must be above 0.`);
    if (!next.currency?.trim()) throw new BadRequestException('Set a currency.');
    if (!Array.isArray(next.weekendDays) || next.weekendDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new BadRequestException('Weekend days must be weekday numbers 0-6.');
    await this.store.set(SETTINGS_KEY, JSON.stringify(next));
    return next;
  }

  listComponents() {
    return this.components.find({ order: { order: 'ASC' } });
  }

  private check(dto: Partial<PayComponentEntity>) {
    if (dto.kind && !['earning', 'deduction'].includes(dto.kind)) throw new BadRequestException('Kind must be earning or deduction.');
    if (dto.calcType && !['fixed', 'percent_basic', 'percent_gross'].includes(dto.calcType)) throw new BadRequestException('Unknown calculation type.');
    if (dto.kind === 'earning' && dto.calcType === 'percent_gross') throw new BadRequestException('An earning cannot be a percentage of gross -- gross includes it.');
    if (dto.defaultValue != null && (Number(dto.defaultValue) < 0 || !Number.isFinite(Number(dto.defaultValue)))) throw new BadRequestException('The value cannot be negative.');
  }

  async createComponent(dto: Partial<PayComponentEntity>) {
    if (!dto.name?.trim()) throw new BadRequestException('Name the component.');
    const row = { kind: 'earning', calcType: 'fixed', defaultValue: 0, appliesTo: 'all', active: true, order: await this.components.count(), ...dto };
    this.check(row);
    return this.components.save(this.components.create({ ...row, id: newId('PC') } as PayComponentEntity));
  }

  async updateComponent(id: string, dto: Partial<PayComponentEntity>) {
    const c = await this.components.findOneBy({ id });
    if (!c) throw new NotFoundException('Pay component not found');
    const next = { ...c, ...dto, id };
    this.check(next);
    return this.components.save(next);
  }

  async removeComponent(id: string) {
    const c = await this.components.findOneBy({ id });
    if (c) await this.components.remove(c);
    return { id, deleted: true };
  }
}
