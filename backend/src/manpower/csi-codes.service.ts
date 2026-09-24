import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CsiCodeEntity } from '../database/entities';
import { COMPANY_COST_CODES, costCodeId } from '../seed-data/company-cost-codes';
import { SettingsService } from '../settings/settings.service';

/** Marks that the company's own list has replaced the generic MasterFormat seed, so it happens once. */
const LIST_KEY = 'csi.list';
const LIST_VERSION = 'company-v1';

/** The company's cost-code rows, with stable ids, in the order supplied. */
export function companyRows(): CsiCodeEntity[] {
  const taken = new Set<string>();
  return COMPANY_COST_CODES.map((c, i) => ({
    id: costCodeId(c.code, c.name, taken), code: c.code, division: c.name, description: c.description || '', active: true, order: i,
  }) as CsiCodeEntity);
}

@Injectable()
export class CsiCodesService implements OnApplicationBootstrap {
  private readonly log = new Logger('CsiCodesService');

  constructor(
    @InjectRepository(CsiCodeEntity) private readonly repo: Repository<CsiCodeEntity>,
    private readonly settings?: SettingsService,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(companyRows(), { chunk: 40 });
        await this.settings?.set(LIST_KEY, LIST_VERSION);
        this.log.log(`Seeded ${COMPANY_COST_CODES.length} cost codes`);
      } else {
        await this.adoptCompanyList();
      }
    } catch (err) {
      this.log.error('Cost code setup failed: ' + (err as Error).message);
    }
  }

  /**
   * Once: the generic "NN 00 00" divisions become the company's "NN" divisions
   * under the same ids (so logs and timesheets that point at them stay linked),
   * and the company's sub-codes are added. Codes someone added by hand are kept.
   */
  async adoptCompanyList() {
    if (!this.settings || (await this.settings.get(LIST_KEY)) === LIST_VERSION) return;
    const existing = await this.repo.find();
    const byId = new Map(existing.map((r) => [r.id, r]));
    const rows = companyRows().map((r) => {
      const old = byId.get(r.id);
      // A generic division row becomes the company's; anything else with this id was the company's already.
      return old ? Object.assign(old, { code: r.code, division: r.division, description: old.description || r.description, order: r.order }) : r;
    });
    const custom = existing.filter((r) => !rows.some((x) => x.id === r.id));
    custom.forEach((r, i) => { r.order = rows.length + i; });
    await this.repo.save([...rows, ...custom], { chunk: 40 });
    await this.settings.set(LIST_KEY, LIST_VERSION);
    this.log.log(`Cost codes now follow the company list: ${rows.length} codes, ${custom.length} of your own kept`);
  }

  findAll() {
    return this.repo.find({ order: { order: 'ASC' } });
  }

  async create(dto: any) {
    const id = dto.id || 'CSI-' + String(Date.now());
    const order = dto.order ?? (await this.repo.count());
    // Inserting into the middle of the list (a code under its division) makes room first.
    if (dto.order != null) await this.repo.createQueryBuilder().update().set({ order: () => '[order] + 1' }).where('[order] >= :o', { o: order }).execute();
    const csiCode = { active: true, description: '', ...dto, order, id };
    return this.repo.save(this.repo.create(csiCode as Partial<CsiCodeEntity>));
  }

  async update(id: string, dto: any) {
    const csiCode = await this.repo.findOneBy({ id });
    if (!csiCode) throw new NotFoundException(`CSI code ${id} not found`);
    Object.assign(csiCode, dto, { id });
    return this.repo.save(csiCode);
  }

  async remove(id: string) {
    const csiCode = await this.repo.findOneBy({ id });
    if (csiCode) await this.repo.remove(csiCode);
    return { id, deleted: true };
  }
}
