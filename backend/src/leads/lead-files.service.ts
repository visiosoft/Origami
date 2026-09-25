import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadEntity, LeadFilesEntity, type LeadAttachment } from '../database/entities';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { normalizeAttachments, subId } from '../database/task.types';

const clean = (v: unknown, max = 120) => String(v ?? '').replace(/[\r\n]/g, ' ').trim().slice(0, max);

/** Files on a lead, each remembering the stage it was added in. */
@Injectable()
export class LeadFilesService {
  constructor(
    @InjectRepository(LeadFilesEntity) private readonly repo: Repository<LeadFilesEntity>,
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
    private readonly attachments: AttachmentsService,
  ) {}

  private async row(leadId: string) {
    return (await this.repo.findOneBy({ leadId })) || this.repo.create({ leadId, attachments: [] });
  }

  async list(leadId: string): Promise<LeadAttachment[]> {
    return normalizeAttachments((await this.repo.findOneBy({ leadId }))?.attachments) as LeadAttachment[];
  }

  private async save(row: LeadFilesEntity, next: LeadAttachment[]) {
    row.attachments = next;
    row.updatedAt = new Date().toISOString();
    await this.repo.save(row);
    return next;
  }

  /** Drive folder: one per lead, named after it, so the files are findable in Drive too. */
  private async folder(leadId: string) {
    const lead = await this.leads.findOneBy({ id: leadId });
    const name = clean(lead?.leadName || [lead?.firstName, lead?.lastName].filter(Boolean).join(' '), 80);
    return `Lead ${leadId}${name ? ` - ${name}` : ''}`;
  }

  private tag(stage?: string, stageName?: string) {
    const key = clean(stage, 60);
    return key ? { stage: key, stageName: clean(stageName) || key } : {};
  }

  async addAttachments(leadId: string, files: any[], actor: UploadActor, stage?: string, stageName?: string) {
    const row = await this.row(leadId);
    const added = (await this.attachments.upload(files, await this.folder(leadId), actor)).map((a) => ({ ...a, ...this.tag(stage, stageName) }));
    return this.save(row, [...normalizeAttachments(row.attachments), ...added]);
  }

  async addLink(leadId: string, name: string, url: string, actor: UploadActor, stage?: string, stageName?: string) {
    const row = await this.row(leadId);
    const att: LeadAttachment = {
      id: subId('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: new Date().toISOString(),
      ...this.tag(stage, stageName),
    };
    return this.save(row, [...normalizeAttachments(row.attachments), att]);
  }

  async removeAttachment(leadId: string, attId: string) {
    const row = await this.row(leadId);
    const all = normalizeAttachments(row.attachments) as LeadAttachment[];
    const target = all.find((a) => a.id === attId);
    if (!target) throw new NotFoundException('File not found');
    await this.attachments.discard(target);
    return this.save(row, all.filter((a) => a.id !== attId));
  }

  async attachment(leadId: string, attId: string) {
    const att = (await this.list(leadId)).find((a) => a.id === attId);
    if (!att) throw new NotFoundException('File not found');
    return att;
  }
}
