import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectProgramEntity, ProjectEntity } from '../database/entities';

export interface ProgramActor { id?: string; name?: string }

/**
 * The Project Program document, one per project.
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

  /** Mark the program finished, or reopen it by passing false. */
  async setComplete(projectId: number, complete: boolean) {
    const row = await this.repo.findOneBy({ projectId });
    if (!row) throw new BadRequestException('Nothing has been filled in yet.');
    row.completedAt = complete ? new Date().toISOString() : '';
    await this.repo.save(row);
    return this.get(projectId);
  }
}
