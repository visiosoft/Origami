import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectSectionEntity } from '../database/entities';
import { DEFAULT_SECTIONS, defaultSectionsFor, ProjectSection } from '../seed-data/project-tasks';

@Injectable()
export class SectionsService implements OnApplicationBootstrap {
  private readonly log = new Logger('SectionsService');

  constructor(
    @InjectRepository(ProjectSectionEntity) private readonly repo: Repository<ProjectSectionEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_SECTIONS as unknown as ProjectSectionEntity[]);
        this.log.log(`Seeded ${DEFAULT_SECTIONS.length} project sections`);
      }
    } catch (err) {
      this.log.error('Section seed failed: ' + (err as Error).message);
    }
  }

  async getById(id: string): Promise<ProjectSection | undefined> {
    return (await this.repo.findOneBy({ id })) ?? undefined;
  }

  // Returns a project's sections, creating the default set the first time.
  async forProject(projectId: number): Promise<ProjectSection[]> {
    if (!Number.isFinite(projectId)) return []; // guard NaN/invalid ids
    let rows = await this.repo.find({ where: { projectId }, order: { order: 'ASC' } });
    if (!rows.length) {
      rows = await this.repo.save(defaultSectionsFor(projectId) as unknown as ProjectSectionEntity[]);
    }
    return rows;
  }

  create(dto: any) {
    const projectId = Number(dto.projectId);
    const section = { name: 'New Section', order: 0, ...dto, projectId, id: dto.id || 'S-' + Date.now() };
    return this.repo.save(this.repo.create(section as Partial<ProjectSectionEntity>));
  }

  async update(id: string, dto: any) {
    let section = await this.repo.findOneBy({ id });
    if (!section) section = this.repo.create({ id } as Partial<ProjectSectionEntity>);
    Object.assign(section, dto, { id });
    return this.repo.save(section);
  }

  async remove(id: string) {
    const section = await this.repo.findOneBy({ id });
    if (section) await this.repo.remove(section);
    return { id, deleted: true };
  }
}
