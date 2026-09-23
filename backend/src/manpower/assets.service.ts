import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetEntity, AssetIssueEntity, EmployeeEntity } from '../database/entities';
import { HR_MODULE, ManpowerAccess, type Actor } from './manpower-access.service';
import { round2 } from './payroll.calc';
import { LEFT_STATUSES, lifecycleStatus, newId, todayISO } from './workforce.util';

export const ASSET_CATEGORIES = ['laptop', 'mobile', 'sim', 'tools', 'uniform', 'vehicle', 'access_card', 'tablet', 'other'];
const CONDITIONS = ['new', 'good', 'fair', 'poor', 'damaged'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Next free "AST-0001" tag, never reusing one. */
export function nextAssetTag(tags: (string | null | undefined)[]) {
  const max = tags.reduce((m, t) => { const x = /^AST-(\d+)$/.exec(t || ''); return x ? Math.max(m, Number(x[1])) : m; }, 0);
  return 'AST-' + String(max + 1).padStart(4, '0');
}

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(AssetEntity) private readonly assets: Repository<AssetEntity>,
    @InjectRepository(AssetIssueEntity) private readonly issues: Repository<AssetIssueEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    private readonly access: ManpowerAccess,
  ) {}

  /** Every asset with whoever holds it now. */
  async list() {
    const [assets, open] = await Promise.all([this.assets.find({ order: { assetTag: 'ASC' } }), this.issues.find({ where: { status: 'open' } })]);
    const holder = new Map(open.map((i) => [i.assetId, i]));
    return assets.map((a) => ({ ...a, currentIssue: holder.get(a.id) || null }));
  }

  async history(assetId: string) {
    return (await this.issues.find({ where: { assetId } })).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }

  /** What an employee holds now and has held -- for their profile and, later, exit clearance. */
  async forEmployee(employeeId: string) {
    const issues = (await this.issues.find({ where: { employeeId } })).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    const assets = await this.assets.find();
    const byId = new Map(assets.map((a) => [a.id, a]));
    return issues.map((i) => ({ ...i, asset: byId.get(i.assetId) }));
  }

  private checkFields(dto: Partial<AssetEntity>) {
    if (dto.category && !ASSET_CATEGORIES.includes(dto.category)) throw new BadRequestException('Unknown asset category.');
    if (dto.condition && !CONDITIONS.includes(dto.condition)) throw new BadRequestException('Unknown condition.');
    if (dto.cost != null && !(Number(dto.cost) >= 0)) throw new BadRequestException('Cost cannot be negative.');
  }

  async create(dto: Partial<AssetEntity>, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'register assets');
    if (!dto.name?.trim()) throw new BadRequestException('Name the asset.');
    this.checkFields(dto);
    if (dto.serialNumber?.trim() && (await this.assets.findOneBy({ serialNumber: dto.serialNumber.trim() }))) {
      throw new BadRequestException('An asset with that serial number is already registered.');
    }
    const tags = (await this.assets.find({ select: { assetTag: true } as any })).map((a) => a.assetTag);
    const now = new Date().toISOString();
    return this.assets.save(this.assets.create({
      category: 'other', condition: 'good', ...dto, name: dto.name.trim(), serialNumber: dto.serialNumber?.trim() || undefined,
      status: 'available', assetTag: dto.assetTag?.trim() || nextAssetTag(tags), id: newId('AS'), createdAt: now, updatedAt: now,
    }));
  }

  async update(id: string, dto: Partial<AssetEntity>, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'edit assets');
    const a = await this.load(id);
    this.checkFields(dto);
    const { status: _status, ...rest } = dto;
    Object.assign(a, rest, { id, updatedAt: new Date().toISOString() });
    return this.assets.save(a);
  }

  /** Repair / retire / back in stock -- for items nobody holds. Issuing and returning go through issue/return. */
  async setStatus(id: string, status: string, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'change asset status');
    if (!['available', 'in_repair', 'retired'].includes(status)) throw new BadRequestException('Status can be set to available, in repair or retired.');
    const a = await this.load(id);
    if (a.status === 'issued') throw new BadRequestException('This is with someone -- record its return first.');
    Object.assign(a, { status, updatedAt: new Date().toISOString() });
    return this.assets.save(a);
  }

  private async load(id: string) {
    const a = await this.assets.findOneBy({ id });
    if (!a) throw new NotFoundException('Asset not found');
    return a;
  }

  async issue(assetId: string, dto: { employeeId: string; date?: string; expectedReturn?: string; notes?: string; replacesIssueId?: string }, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'issue assets');
    const a = await this.load(assetId);
    if (a.status !== 'available') throw new BadRequestException(`${a.name} is ${a.status.replace('_', ' ')} -- it can't be issued.`);
    const emp = await this.employees.findOneBy({ id: dto.employeeId });
    if (!emp) throw new BadRequestException('Pick the employee.');
    if (LEFT_STATUSES.includes(lifecycleStatus(emp))) throw new BadRequestException(`${emp.name} no longer works here.`);
    const date = dto.date || todayISO();
    if (!ISO.test(date)) throw new BadRequestException('Give the issue date.');
    if (dto.expectedReturn && dto.expectedReturn < date) throw new BadRequestException('The return date is before the issue date.');
    return this.assets.manager.transaction(async (m) => {
      const issue = m.getRepository(AssetIssueEntity).create({
        id: newId('AI'), assetId, employeeId: emp.id, issuedAt: date, expectedReturn: dto.expectedReturn, status: 'open',
        notes: dto.notes, replacesIssueId: dto.replacesIssueId, issuedByName: actor.name,
      });
      Object.assign(a, { status: 'issued', updatedAt: new Date().toISOString() });
      await m.getRepository(AssetEntity).save(a);
      return m.getRepository(AssetIssueEntity).save(issue);
    });
  }

  private async openIssue(id: string) {
    const i = await this.issues.findOneBy({ id });
    if (!i) throw new NotFoundException('Issue record not found');
    if (i.status !== 'open') throw new BadRequestException(`This was already ${i.status}.`);
    return i;
  }

  /** Back from the employee; its condition is recorded, and a damaged item can go straight to repair. */
  async returnIssue(id: string, dto: { date?: string; condition?: string; toRepair?: boolean; chargeAmount?: number; notes?: string }, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'record asset returns');
    const i = await this.openIssue(id);
    const date = dto.date || todayISO();
    if (date < i.issuedAt) throw new BadRequestException('The return is before the item was issued.');
    const condition = dto.condition || 'good';
    if (!CONDITIONS.includes(condition)) throw new BadRequestException('Unknown condition.');
    const charge = dto.chargeAmount != null ? round2(Number(dto.chargeAmount)) : undefined;
    if (charge != null && !(charge >= 0)) throw new BadRequestException('A damage charge cannot be negative.');
    return this.assets.manager.transaction(async (m) => {
      Object.assign(i, { status: 'returned', returnedAt: date, returnCondition: condition, chargeAmount: charge, closedByName: actor.name, notes: [i.notes, dto.notes].filter(Boolean).join('\n') || undefined });
      const a = await m.getRepository(AssetEntity).findOneBy({ id: i.assetId });
      if (a) {
        Object.assign(a, { status: dto.toRepair ? 'in_repair' : 'available', condition, updatedAt: new Date().toISOString() });
        await m.getRepository(AssetEntity).save(a);
      }
      return m.getRepository(AssetIssueEntity).save(i);
    });
  }

  /** Lost while issued: the item leaves stock, and what the employee owes is noted for their final settlement. */
  async reportLost(id: string, dto: { date?: string; chargeAmount?: number; notes?: string }, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'report lost assets');
    const i = await this.openIssue(id);
    const charge = dto.chargeAmount != null ? round2(Number(dto.chargeAmount)) : 0;
    if (!(charge >= 0)) throw new BadRequestException('The charge cannot be negative.');
    return this.assets.manager.transaction(async (m) => {
      Object.assign(i, { status: 'lost', returnedAt: dto.date || todayISO(), chargeAmount: charge, closedByName: actor.name, notes: [i.notes, dto.notes].filter(Boolean).join('\n') || undefined });
      const a = await m.getRepository(AssetEntity).findOneBy({ id: i.assetId });
      if (a) {
        Object.assign(a, { status: 'lost', updatedAt: new Date().toISOString() });
        await m.getRepository(AssetEntity).save(a);
      }
      return m.getRepository(AssetIssueEntity).save(i);
    });
  }
}
