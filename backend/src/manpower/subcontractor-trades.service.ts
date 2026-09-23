import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractorEntity, SubcontractorTradeEntity } from '../database/entities';
import { DEFAULT_SUBCONTRACTOR_TRADES } from '../seed-data/subcontractor-trades';
import { HR_MODULE, ManpowerAccess, type Actor } from './manpower-access.service';

export const SUBTRADE_CATEGORIES = ['general_engineering', 'general_building', 'specialty', 'limited_specialty', 'other'];

@Injectable()
export class SubcontractorTradesService implements OnApplicationBootstrap {
  private readonly log = new Logger('SubcontractorTradesService');

  constructor(
    @InjectRepository(SubcontractorTradeEntity) private readonly repo: Repository<SubcontractorTradeEntity>,
    @InjectRepository(ContractorEntity) private readonly contractors: Repository<ContractorEntity>,
    private readonly access: ManpowerAccess,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_SUBCONTRACTOR_TRADES as SubcontractorTradeEntity[]);
        this.log.log(`Seeded ${DEFAULT_SUBCONTRACTOR_TRADES.length} subcontractor trades`);
      }
    } catch (err) {
      this.log.error('Subcontractor trade seed failed: ' + (err as Error).message);
    }
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
    await this.access.require(actor, HR_MODULE, 'change subcontractor trades');
    if (!dto.code?.trim() || !dto.name?.trim()) throw new BadRequestException('A code and a name are required.');
    await this.check(dto);
    return this.repo.save(this.repo.create({
      category: 'other', active: true, order: await this.repo.count(), ...dto, name: dto.name.trim(),
      id: 'SCT-' + dto.code!.replace(/[^A-Z0-9-]/g, ''),
    }));
  }

  async update(id: string, dto: Partial<SubcontractorTradeEntity>, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'change subcontractor trades');
    const t = await this.repo.findOneBy({ id });
    if (!t) throw new NotFoundException('Trade not found');
    await this.check(dto, id);
    Object.assign(t, dto, { id, name: dto.name?.trim() ?? t.name });
    return this.repo.save(t);
  }

  async remove(id: string, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'change subcontractor trades');
    const using = (await this.contractors.find()).filter((c) => (c.tradeIds || []).includes(id));
    if (using.length) throw new BadRequestException(`${using.map((c) => c.companyName).join(', ')} hold this classification -- make it inactive instead.`);
    const t = await this.repo.findOneBy({ id });
    if (t) await this.repo.remove(t);
    return { id, deleted: true };
  }
}
