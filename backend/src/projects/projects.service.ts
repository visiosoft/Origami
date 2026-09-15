import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from '../database/entities';

@Injectable()
export class ProjectsService implements OnApplicationBootstrap {
  private readonly log = new Logger('ProjectsService');

  constructor(
    @InjectRepository(ProjectEntity) private readonly repo: Repository<ProjectEntity>,
  ) {}

  /** The "Leads" stage was renamed to "Kickoff" -- carry any row saved under the old name forward. */
  async onApplicationBootstrap() {
    try {
      const stale = await this.repo.findBy({ stage: 'Leads' });
      if (!stale.length) return;
      for (const p of stale) p.stage = 'Kickoff';
      await this.repo.save(stale);
      this.log.log(`Renamed ${stale.length} project(s) from stage "Leads" to "Kickoff"`);
    } catch (err) {
      this.log.warn('Kickoff stage migration failed: ' + (err as Error).message);
    }
  }

  findAll() {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  async findOne(id: string) {
    const project = await this.repo.findOneBy({ id: Number(id) });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async create(dto: any) {
    const rows = await this.repo.find();
    const id = Number(dto.id) || rows.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;
    // Fill NOT NULL columns so a minimal form doesn't violate the schema.
    const project = {
      priority: 'Medium', location: '', typeOfWork: '', contractType: '', contractAmt: '$0',
      estStart: '', duration: '', scope: '', stage: 'Kickoff', progress: 0, referral: '',
      contactedBy: '', imgColor: '#173326', img: '',
      ...dto, id,
    };
    return this.repo.save(this.repo.create(project as Partial<ProjectEntity>));
  }

  findByLeadId(leadId: string) {
    return this.repo.findOneBy({ leadId });
  }

  /**
   * Give a lead its place on the Projects page from the moment it exists,
   * sitting in the "Kickoff" stage, rather than only once it is approved and
   * converted. Safe to call more than once -- a lead that already has a
   * project row (this one, or the one conversion later updates in place) is
   * left untouched.
   */
  async ensureForLead(deal: { id: string; name: string; value?: string; source?: string; assignee?: string }) {
    const existing = await this.findByLeadId(deal.id);
    if (existing) return existing;
    return this.create({
      name: deal.name,
      stage: 'Kickoff',
      contractAmt: deal.value || '$0',
      referral: deal.source || '',
      contactedBy: (deal.assignee && deal.assignee !== 'Unassigned') ? deal.assignee : '',
      leadId: deal.id,
    });
  }

  async update(id: string, dto: any) {
    await this.repo.update({ id: Number(id) }, dto as Partial<ProjectEntity>);
    return this.findOne(id);
  }

  async remove(id: string) {
    const project = await this.repo.findOneBy({ id: Number(id) });
    if (project) await this.repo.remove(project);
    return { id: Number(id), deleted: true };
  }
}
