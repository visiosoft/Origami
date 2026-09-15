import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectProgramEntity, ProjectEntity, LeadProgramEntity, LeadEntity, ProjectProgramVersionEntity } from '../database/entities';
import { PeopleService } from '../people/people.service';

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
    @InjectRepository(ProjectProgramVersionEntity) private readonly versions: Repository<ProjectProgramVersionEntity>,
    private readonly people: PeopleService,
  ) {}

  /** Snapshot what was just saved, so the document's history survives its own overwrite. */
  private async snapshot(ownerKey: string, data: string, savedAt: string, savedBy: string) {
    await this.versions.save(this.versions.create({ ownerKey, data, savedAt, savedBy }));
  }

  /** Every past save, newest first -- the data itself is left out to keep the list light. */
  async listVersions(ownerKey: string) {
    const rows = await this.versions.find({ where: { ownerKey }, order: { id: 'DESC' } });
    return rows.map((v) => ({ id: v.id, savedAt: v.savedAt, savedBy: v.savedBy }));
  }

  async getVersion(ownerKey: string, id: number) {
    const v = await this.versions.findOneBy({ id, ownerKey });
    if (!v) throw new BadRequestException('That version no longer exists.');
    return { id: v.id, savedAt: v.savedAt, savedBy: v.savedBy, data: this.parse(v.data) };
  }

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
      signedAt: row?.signedAt || '',
      signedByName: row?.signedByName || '',
      signedByEmail: row?.signedByEmail || '',
      signatureImage: row?.signatureImage || '',
    };
  }

  /** Verifies the caller is the client on record for this project before handing back anything. */
  private async assertClientAccess(projectId: number, email: string) {
    const project = await this.projects.findOneBy({ id: projectId });
    if (!project || !(await this.people.isClientOnProject(email, project.name))) {
      throw new ForbiddenException('This project is not linked to your account.');
    }
    return project;
  }

  /** The document a linked client is allowed to see -- same shape as `get`, gated by the People directory. */
  async getForClient(projectId: number, email: string) {
    await this.assertClientAccess(projectId, email);
    return this.get(projectId);
  }

  /**
   * Record the client's e-signature.
   *
   * `signedAt`, `ip` and `userAgent` are the server's own record of the
   * request, supplied by the controller from the verified session and socket
   * -- never anything the client's browser claims -- which is what makes this
   * worth calling a certification rather than just a saved drawing.
   */
  async sign(
    projectId: number,
    signer: { name: string; email: string },
    image: string,
    meta: { ip: string; userAgent: string },
  ) {
    if (!signer.name?.trim()) throw new BadRequestException('Type your name to certify the signature.');
    if (!image?.trim()) throw new BadRequestException('Draw your signature before submitting.');
    await this.assertClientAccess(projectId, signer.email);
    const row = await this.repo.findOneBy({ projectId });
    if (!row) throw new BadRequestException('There is nothing to sign yet.');
    row.signedAt = new Date().toISOString();
    row.signedByName = signer.name.trim();
    row.signedByEmail = signer.email;
    row.signatureImage = image;
    row.signerIp = meta.ip || '';
    row.signerUserAgent = meta.userAgent || '';
    await this.repo.save(row);
    // The certification is itself worth a version -- it marks exactly which
    // set of answers the client agreed to.
    await this.snapshot(`project:${projectId}`, row.data, row.signedAt, `${row.signedByName} (signed)`);
    return this.get(projectId);
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
    await this.snapshot(`project:${projectId}`, row.data, row.updatedAt, row.updatedBy);
    return this.get(projectId);
  }

  async listVersionsFor(projectId: number) {
    return this.listVersions(`project:${projectId}`);
  }

  async getVersionFor(projectId: number, id: number) {
    return this.getVersion(`project:${projectId}`, id);
  }

  /** Copies an old version's answers back over the current document -- itself logged as a new version. */
  async restoreVersion(projectId: number, id: number, actor?: ProgramActor) {
    const v = await this.getVersion(`project:${projectId}`, id);
    return this.save(projectId, v.data, actor);
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
    await this.snapshot(`lead:${leadId}`, row.data, row.updatedAt, row.updatedBy);
    return this.getLead(leadId);
  }

  async listVersionsForLead(leadId: string) {
    return this.listVersions(`lead:${leadId}`);
  }

  async getVersionForLead(leadId: string, id: number) {
    return this.getVersion(`lead:${leadId}`, id);
  }

  async restoreVersionLead(leadId: string, id: number, actor?: ProgramActor) {
    const v = await this.getVersion(`lead:${leadId}`, id);
    return this.saveLead(leadId, v.data, actor);
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
