import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractorEntity, EmployeeEntity } from '../database/entities';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { normalizeAttachments, subId, type TaskAttachment } from '../database/task.types';
import { expiryStatus } from './employee-records.service';
import { newId } from './workforce.util';

@Injectable()
export class ContractorsService {
  constructor(
    @InjectRepository(ContractorEntity) private readonly repo: Repository<ContractorEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    private readonly attachments: AttachmentsService,
  ) {}

  private hydrate(c: ContractorEntity, workerCount: number) {
    return {
      ...c,
      attachments: normalizeAttachments(c.attachments),
      contractStatus: expiryStatus(c.contractEnd),
      insuranceStatus: expiryStatus(c.insuranceExpiry),
      licenseStatus: expiryStatus(c.licenseExpiry),
      tradeIds: c.tradeIds || [],
      workerCount,
    };
  }

  private async counts() {
    const workers = await this.employees.find({ select: { id: true, contractorId: true } as any });
    const map = new Map<string, number>();
    for (const w of workers) if (w.contractorId) map.set(w.contractorId, (map.get(w.contractorId) || 0) + 1);
    return map;
  }

  async findAll() {
    const [rows, counts] = await Promise.all([this.repo.find({ order: { companyName: 'ASC' } }), this.counts()]);
    return rows.map((c) => this.hydrate(c, counts.get(c.id) || 0));
  }

  private async load(id: string) {
    const c = await this.repo.findOneBy({ id });
    if (!c) throw new NotFoundException(`Contractor ${id} not found`);
    return c;
  }

  private async one(c: ContractorEntity) {
    return this.hydrate(c, (await this.counts()).get(c.id) || 0);
  }

  async create(dto: any) {
    if (!dto.companyName?.trim()) throw new BadRequestException('A company name is required.');
    if (dto.contractStart && dto.contractEnd && dto.contractEnd < dto.contractStart) throw new BadRequestException('The contract ends before it starts.');
    const now = new Date().toISOString();
    const c = this.repo.create({ status: 'active', attachments: [], createdAt: now, updatedAt: now, ...dto, id: newId('CTR') } as Partial<ContractorEntity>);
    return this.one(await this.repo.save(c));
  }

  async update(id: string, dto: any) {
    const c = await this.load(id);
    const { attachments: _ignored, ...rest } = dto;
    Object.assign(c, rest, { id, updatedAt: new Date().toISOString() });
    if (c.contractStart && c.contractEnd && c.contractEnd < c.contractStart) throw new BadRequestException('The contract ends before it starts.');
    return this.one(await this.repo.save(c));
  }

  async remove(id: string) {
    const c = await this.load(id);
    const workers = await this.employees.count({ where: { contractorId: id } });
    if (workers) throw new BadRequestException(`${c.companyName} still has ${workers} worker(s) on record -- set the contractor to Ended instead.`);
    await this.attachments.discardAll(normalizeAttachments(c.attachments));
    await this.repo.remove(c);
    return { id, deleted: true };
  }

  async addAttachments(id: string, files: any[], actor: UploadActor) {
    const c = await this.load(id);
    const added = await this.attachments.upload(files, 'Contractors', actor);
    c.attachments = [...normalizeAttachments(c.attachments), ...added];
    return this.one(await this.repo.save(c));
  }

  async addLink(id: string, name: string, url: string, actor: UploadActor) {
    const c = await this.load(id);
    const att: TaskAttachment = { id: subId('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: new Date().toISOString() };
    c.attachments = [...normalizeAttachments(c.attachments), att];
    return this.one(await this.repo.save(c));
  }

  async removeAttachment(id: string, attId: string) {
    const c = await this.load(id);
    const all = normalizeAttachments(c.attachments);
    const target = all.find((a) => a.id === attId);
    if (!target) throw new NotFoundException('Attachment not found');
    await this.attachments.discard(target);
    c.attachments = all.filter((a) => a.id !== attId);
    return this.one(await this.repo.save(c));
  }

  async attachment(id: string, attId: string) {
    const c = await this.load(id);
    const att = normalizeAttachments(c.attachments).find((a) => a.id === attId);
    if (!att) throw new NotFoundException('Attachment not found');
    return att;
  }
}
