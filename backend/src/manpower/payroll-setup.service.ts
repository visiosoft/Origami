import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayComponentEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { DEFAULT_PAYROLL_SETTINGS, type PayrollSettings } from './payroll.calc';
import { newId } from './workforce.util';

const SETTINGS_KEY = 'payroll.settings';

/** Seeded at zero: they only apply once an amount is set company-wide or on an employee. */
const DEFAULT_COMPONENTS: Omit<PayComponentEntity, 'id' | 'order'>[] = [
  { name: 'Site allowance', kind: 'earning', calcType: 'fixed', defaultValue: 0, appliesTo: 'all', category: 'allowance', active: true },
  { name: 'Travel allowance', kind: 'earning', calcType: 'fixed', defaultValue: 0, appliesTo: 'all', category: 'allowance', active: true },
  { name: 'Food allowance', kind: 'earning', calcType: 'fixed', defaultValue: 0, appliesTo: 'all', category: 'allowance', active: true },
  { name: 'Accommodation allowance', kind: 'earning', calcType: 'fixed', defaultValue: 0, appliesTo: 'monthly', category: 'allowance', active: true },
  { name: 'Income tax', kind: 'deduction', calcType: 'percent_gross', defaultValue: 0, appliesTo: 'monthly', category: 'tax', active: true },
  { name: 'Social security (EOBI)', kind: 'deduction', calcType: 'percent_basic', defaultValue: 0, appliesTo: 'all', category: 'social_security', active: true },
  { name: 'Insurance', kind: 'deduction', calcType: 'fixed', defaultValue: 0, appliesTo: 'all', category: 'insurance', active: true },
];

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
        await this.components.save(DEFAULT_COMPONENTS.map((c, i) => ({ ...c, id: 'PC-' + String(i + 1).padStart(2, '0'), order: i })) as PayComponentEntity[]);
        this.log.log(`Seeded ${DEFAULT_COMPONENTS.length} pay components`);
      }
    } catch (err) {
      this.log.error('Pay component seed failed: ' + (err as Error).message);
    }
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
