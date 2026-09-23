import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ContractorEntity, EmployeeAssignmentEntity, EmployeeEntity, SubcontractorTradeEntity, TradeEntity, WorkforceRequestEntity,
} from '../database/entities';
import { DEFAULT_SUBCONTRACTOR_TRADES } from '../seed-data/subcontractor-trades';
import { DEFAULT_TRADES } from '../seed-data/trades';
import { HR_MODULE, ManpowerAccess, type Actor } from './manpower-access.service';

export const SUBTRADE_CATEGORIES = ['general_engineering', 'general_building', 'specialty', 'limited_specialty', 'other'];

/**
 * The old worker-trade list, mapped onto licence classifications. Roles that
 * aren't a licensed trade (driver, helper, foreman, engineer...) have no match:
 * they keep their name as text and in their designation.
 */
export const WORKER_TRADE_CODE: Record<string, string> = {
  Mason: 'C-29', Carpenter: 'C-5', Electrician: 'C-10', Plumber: 'C-36', Welder: 'C-60', 'Steel Fixer': 'C-50',
  Painter: 'C-33', Scaffolder: 'D-39', 'Equipment Operator': 'C-12',
};

@Injectable()
export class SubcontractorTradesService implements OnApplicationBootstrap {
  private readonly log = new Logger('SubcontractorTradesService');

  constructor(
    @InjectRepository(SubcontractorTradeEntity) private readonly repo: Repository<SubcontractorTradeEntity>,
    @InjectRepository(ContractorEntity) private readonly contractors: Repository<ContractorEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    @InjectRepository(EmployeeAssignmentEntity) private readonly assignments: Repository<EmployeeAssignmentEntity>,
    @InjectRepository(WorkforceRequestEntity) private readonly requests: Repository<WorkforceRequestEntity>,
    @InjectRepository(TradeEntity) private readonly oldTrades: Repository<TradeEntity>,
    private readonly access: ManpowerAccess,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_SUBCONTRACTOR_TRADES as SubcontractorTradeEntity[]);
        this.log.log(`Seeded ${DEFAULT_SUBCONTRACTOR_TRADES.length} subcontractor trades`);
      }
      await this.migrateWorkerTrades();
    } catch (err) {
      this.log.error('Subcontractor trade setup failed: ' + (err as Error).message);
    }
  }

  /**
   * One trade list for companies and workers: anything still pointing at the
   * old worker-trade list moves to the matching classification. Safe to rerun --
   * only ids that aren't classifications are touched.
   */
  async migrateWorkerTrades() {
    const current = await this.repo.find();
    const isNew = new Set(current.map((t) => t.id));
    const byCode = new Map(current.map((t) => [t.code, t]));
    const oldName = new Map<string, string>(DEFAULT_TRADES.map((t) => [t.id, t.name]));
    for (const t of await this.oldTrades.find().catch(() => [] as TradeEntity[])) oldName.set(t.id, t.name);
    const target = (oldId: string) => byCode.get(WORKER_TRADE_CODE[oldName.get(oldId) || ''] || '');
    const stale = (id?: string | null) => !!id && !isNew.has(id);

    const emps = (await this.employees.find()).filter((e) => stale(e.tradeId));
    for (const e of emps) {
      const t = target(e.tradeId);
      e.trade = t ? t.name : oldName.get(e.tradeId) || e.trade;
      e.tradeId = (t?.id ?? null) as any;
    }
    if (emps.length) await this.employees.save(emps);

    const asg = (await this.assignments.find()).filter((a) => stale(a.tradeId));
    for (const a of asg) a.tradeId = (target(a.tradeId)?.id ?? null) as any;
    if (asg.length) await this.assignments.save(asg);

    const reqs = (await this.requests.find()).filter((r) => (r.lines || []).some((l) => stale(l.tradeId)));
    for (const r of reqs) {
      r.lines = r.lines.map((l) => {
        if (!stale(l.tradeId)) return l;
        const t = target(l.tradeId);
        return { ...l, tradeId: t?.id || '', designation: l.designation || oldName.get(l.tradeId) };
      });
    }
    if (reqs.length) await this.requests.save(reqs);
    if (emps.length + asg.length + reqs.length) this.log.log(`Moved worker trades onto classifications: ${emps.length} employees, ${asg.length} assignments, ${reqs.length} requests`);
  }

  findAll() {
    return this.repo.find({ order: { order: 'ASC' } });
  }

  private async check(dto: Partial<SubcontractorTradeEntity>, id?: string) {
    if (dto.category && !SUBTRADE_CATEGORIES.includes(dto.category)) throw new BadRequestException('Unknown category.');
    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();
      if (!code) throw new BadRequestException('Give the trade a code, e.g. C-10.');
      const clash = (await this.repo.find()).find((t) => t.code.toUpperCase() === code && t.id !== id);
      if (clash) throw new BadRequestException(`${code} is already ${clash.name}.`);
      dto.code = code;
    }
    if (dto.name !== undefined && !dto.name.trim()) throw new BadRequestException('Name the trade.');
  }

  async create(dto: Partial<SubcontractorTradeEntity>, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'change trades');
    if (!dto.code?.trim() || !dto.name?.trim()) throw new BadRequestException('A code and a name are required.');
    await this.check(dto);
    return this.repo.save(this.repo.create({
      category: 'other', active: true, order: await this.repo.count(), ...dto, name: dto.name.trim(),
      id: 'SCT-' + dto.code!.replace(/[^A-Z0-9-]/g, ''),
    }));
  }

  async update(id: string, dto: Partial<SubcontractorTradeEntity>, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'change trades');
    const t = await this.repo.findOneBy({ id });
    if (!t) throw new NotFoundException('Trade not found');
    await this.check(dto, id);
    Object.assign(t, dto, { id, name: dto.name?.trim() ?? t.name });
    return this.repo.save(t);
  }

  async remove(id: string, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'change trades');
    const companies = (await this.contractors.find()).filter((c) => (c.tradeIds || []).includes(id));
    const workers = await this.employees.count({ where: { tradeId: id } });
    if (companies.length || workers) {
      const who = [companies.length && `${companies.length} contractor(s)`, workers && `${workers} worker(s)`].filter(Boolean).join(' and ');
      throw new BadRequestException(`${who} use this trade -- make it inactive instead.`);
    }
    const t = await this.repo.findOneBy({ id });
    if (t) await this.repo.remove(t);
    return { id, deleted: true };
  }
}
