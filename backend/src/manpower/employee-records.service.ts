import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeRecordEntity } from '../database/entities';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { normalizeAttachments, subId, type TaskAttachment } from '../database/task.types';

export type ExpiryStatus = 'none' | 'valid' | 'expiring' | 'expired';

/** Days ahead of expiry at which a record starts showing as "expiring soon". */
export const EXPIRING_WITHIN_DAYS = 30;

/** Computed on read, never stored -- a stored flag would go stale the day after it was written. */
export function expiryStatus(expiryDate: string | null | undefined, today = new Date()): ExpiryStatus {
  if (!expiryDate) return 'none';
  const expiry = new Date(expiryDate + 'T00:00:00');
  if (Number.isNaN(expiry.getTime())) return 'none';
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((expiry.getTime() - start.getTime()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= EXPIRING_WITHIN_DAYS) return 'expiring';
  return 'valid';
}

@Injectable()
export class EmployeeRecordsService {
  constructor(
    @InjectRepository(EmployeeRecordEntity) private readonly repo: Repository<EmployeeRecordEntity>,
    private readonly attachments: AttachmentsService,
  ) {}

  private hydrate(r: EmployeeRecordEntity) {
    return { ...r, attachments: normalizeAttachments(r.attachments), expiryStatus: expiryStatus(r.expiryDate) };
  }

  async findAll(opts: { employeeId?: string; kind?: string }) {
    const where: any = {};
    if (opts.employeeId) where.employeeId = opts.employeeId;
    if (opts.kind) where.kind = opts.kind;
    const rows = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    return rows.map((r) => this.hydrate(r));
  }

  private async load(id: string) {
    const record = await this.repo.findOneBy({ id });
    if (!record) throw new NotFoundException(`Record ${id} not found`);
    return record;
  }

  async create(dto: any) {
    const now = new Date().toISOString();
    const record = this.repo.create({
      attachments: [], createdAt: now, updatedAt: now,
      ...dto,
      id: 'ER-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
    } as Partial<EmployeeRecordEntity>);
    return this.hydrate(await this.repo.save(record));
  }

  async update(id: string, dto: any) {
    const record = await this.load(id);
    const { attachments: _ignored, ...rest } = dto;
    Object.assign(record, rest, { id, updatedAt: new Date().toISOString() });
    return this.hydrate(await this.repo.save(record));
  }

  async remove(id: string) {
    const record = await this.repo.findOneBy({ id });
    if (record) {
      await this.attachments.discardAll(normalizeAttachments(record.attachments));
      await this.repo.remove(record);
    }
    return { id, deleted: true };
  }

  // ------------------------------------------------------------- attachments

  async addAttachments(id: string, files: any[], actor: UploadActor) {
    const record = await this.load(id);
    const added = await this.attachments.upload(files, 'Employee Records', actor);
    record.attachments = [...normalizeAttachments(record.attachments), ...added];
    record.updatedAt = new Date().toISOString();
    return this.hydrate(await this.repo.save(record));
  }

  async addLink(id: string, name: string, url: string, actor: UploadActor) {
    const record = await this.load(id);
    const att: TaskAttachment = { id: subId('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: new Date().toISOString() };
    record.attachments = [...normalizeAttachments(record.attachments), att];
    return this.hydrate(await this.repo.save(record));
  }

  async removeAttachment(id: string, attId: string) {
    const record = await this.load(id);
    const all = normalizeAttachments(record.attachments);
    const target = all.find((a) => a.id === attId);
    if (!target) throw new NotFoundException('Attachment not found');
    await this.attachments.discard(target);
    record.attachments = all.filter((a) => a.id !== attId);
    return this.hydrate(await this.repo.save(record));
  }

  /** Resolved through the record, so a bare Drive id can never pull an arbitrary file. */
  async attachment(id: string, attId: string) {
    const record = await this.load(id);
    const att = normalizeAttachments(record.attachments).find((a) => a.id === attId);
    if (!att) throw new NotFoundException('Attachment not found');
    return att;
  }
}
