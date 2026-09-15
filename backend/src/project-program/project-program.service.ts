import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectProgramEntity, ProjectEntity, LeadProgramEntity, LeadEntity } from '../database/entities';

export interface ProgramActor { id?: string; name?: string }

/**
 * The Project Program document -- one per project, or one per lead when the
 * programme is being produced before conversion.
 *
 * The form's shape lives in the client -- this only keeps what was answered,
 * so adding a question to the wizard never needs a schema change.
 */
@Injectable()
export class ProjectProgramService {
  private readonly log = new Logger('ProjectProgramService');

  constructor(
    @InjectRepository(ProjectProgramEntity) private readonly repo: Repository<ProjectProgramEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(LeadProgramEntity) private readonly leadRepo: Repository<LeadProgramEntity>,
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
  ) {}

  private parse(raw?: string | null): Record<string, any> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      // A document that will not parse is not worth throwing over -- the form
      // opens empty rather than the page failing to load at all.
      return {};
    }
  }

  async get(projectId: number) {
    if (!Number.isFinite(projectId)) throw new BadRequestException('Which project?');
    const row = await this.repo.findOneBy({ projectId });
    return {
      projectId,
      data: this.parse(row?.data),
      updatedAt: row?.updatedAt || '',
      updatedBy: row?.updatedBy || '',
      completedAt: row?.completedAt || '',
      sentAt: row?.sentAt || '',
      sentTo: row?.sentTo || '',
    };
  }

  async save(projectId: number, data: unknown, actor?: ProgramActor) {
    if (!Number.isFinite(projectId)) throw new BadRequestException('Which project?');
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new BadRequestException('The program must be an object of answers.');
    }
    if (!(await this.projects.findOneBy({ id: projectId }))) {
      throw new BadRequestException(`Project ${projectId} not found`);
    }
    const existing = await this.repo.findOneBy({ projectId });
    const row = existing || this.repo.create({ projectId } as Partial<ProjectProgramEntity>);
    row.data = JSON.stringify(data);
    row.updatedAt = new Date().toISOString();
    row.updatedBy = actor?.name || 'System';
    await this.repo.save(row);
    return this.get(projectId);
  }

  /** Record that the program went to the client, and who sent it. */
  async markSent(projectId: number, to: string, actor?: ProgramActor) {
    const row = await this.repo.findOneBy({ projectId });
    if (!row) return;
    row.sentAt = new Date().toISOString();
    row.sentTo = to || '';
    row.updatedBy = actor?.name || row.updatedBy || 'System';
    await this.repo.save(row);
  }

  /** Mark the program finished, or reopen it by passing false. */
  async setComplete(projectId: number, complete: boolean) {
    const row = await this.repo.findOneBy({ projectId });
    if (!row) throw new BadRequestException('Nothing has been filled in yet.');
    row.completedAt = complete ? new Date().toISOString() : '';
    await this.repo.save(row);
    return this.get(projectId);
  }

  // ------------------------------------------------------------------
  // The lead-side mirror of the four methods above. Kept as separate,
  // parallel methods rather than a shared "owner" parameter threaded through
  // the project ones -- projectId's numeric type runs deep enough (Number.
  // isFinite checks, the ProjectEntity FK) that folding a string-keyed lead
  // path into the same methods would mean type-narrowing at every call site
  // instead of once, here.
  // ------------------------------------------------------------------

  async getLead(leadId: string) {
    if (!leadId) throw new BadRequestException('Which lead?');
    const row = await this.leadRepo.findOneBy({ leadId });
    return {
      leadId,
      data: this.parse(row?.data),
      updatedAt: row?.updatedAt || '',
      updatedBy: row?.updatedBy || '',
      completedAt: row?.completedAt || '',
      sentAt: row?.sentAt || '',
      sentTo: row?.sentTo || '',
    };
  }

  async saveLead(leadId: string, data: unknown, actor?: ProgramActor) {
    if (!leadId) throw new BadRequestException('Which lead?');
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new BadRequestException('The program must be an object of answers.');
    }
    if (!(await this.leads.findOneBy({ id: leadId }))) {
      throw new BadRequestException(`Lead ${leadId} not found`);
    }
    const existing = await this.leadRepo.findOneBy({ leadId });
    const row = existing || this.leadRepo.create({ leadId } as Partial<LeadProgramEntity>);
    row.data = JSON.stringify(data);
    row.updatedAt = new Date().toISOString();
    row.updatedBy = actor?.name || 'System';
    await this.leadRepo.save(row);
    return this.getLead(leadId);
  }

  async markSentLead(leadId: string, to: string, actor?: ProgramActor) {
    const row = await this.leadRepo.findOneBy({ leadId });
    if (!row) return;
    row.sentAt = new Date().toISOString();
    row.sentTo = to || '';
    row.updatedBy = actor?.name || row.updatedBy || 'System';
    await this.leadRepo.save(row);
  }

  async setCompleteLead(leadId: string, complete: boolean) {
    const row = await this.leadRepo.findOneBy({ leadId });
    if (!row) throw new BadRequestException('Nothing has been filled in yet.');
    row.completedAt = complete ? new Date().toISOString() : '';
    await this.leadRepo.save(row);
    return this.getLead(leadId);
  }
}
