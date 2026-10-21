import { Injectable, Optional, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotifyHub } from '../notifications/notify-hub.service';
import { ProjectEntity } from '../database/entities';

@Injectable()
export class ProjectsService implements OnApplicationBootstrap {
  private readonly log = new Logger('ProjectsService');

  constructor(
    @InjectRepository(ProjectEntity) private readonly repo: Repository<ProjectEntity>,
    @Optional() private readonly hub?: NotifyHub,
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
  async ensureForLead(deal: { id: string; name: string; value?: string; source?: string; assignee?: string; location?: string }) {
    const existing = await this.findByLeadId(deal.id);
    if (existing) return existing;
    return this.create({
      name: deal.name,
      stage: 'Kickoff',
      contractAmt: deal.value || '$0',
      location: deal.location || '',
      referral: deal.source || '',
      contactedBy: (deal.assignee && deal.assignee !== 'Unassigned') ? deal.assignee : '',
      leadId: deal.id,
    });
  }

  async update(id: string, dto: any, actor?: { id?: string; name?: string }) {
    // Hold is changed only through /projects/:id/hold and /resume (they keep the
    // follow-up task in step) -- a save of a stale copy mustn't undo it.
    const patch = { ...(dto || {}) };
    for (const k of ['holdSince', 'holdUntil', 'holdReason', 'holdBy', 'holdTaskId', 'holdHistory']) delete patch[k];
    if (!Object.keys(patch).length) return this.findOne(id);
    const before = this.hub ? await this.repo.findOneBy({ id: Number(id) }) : null;
    await this.repo.update({ id: Number(id) }, patch as Partial<ProjectEntity>);
    if (before) this.statusNotices(before, patch, actor);
    return this.findOne(id);
  }

  /** Design phase or construction stage moved: "Design / Construction status changes" (daily digest by default). */
  private statusNotices(before: ProjectEntity, patch: Partial<ProjectEntity>, actor?: { id?: string }) {
    const send = (event: string, title: string, path: string) =>
      void this.hub!.broadcast(event, { title, path, actorId: actor?.id }, { projectName: before.name }).catch(() => undefined);
    // A High Viz project's moves also go to everyone following High Viz.
    const viz = (patch.highViz ?? before.highViz) === true;
    if (patch.highViz === true && !before.highViz) send('high_viz', `${before.name} is now High Viz`, `/design/${before.id}`);
    if (patch.designPhase !== undefined && patch.designPhase && patch.designPhase !== before.designPhase) {
      send('design_status', `${before.name} moved to ${patch.designPhase}`, `/design/${before.id}`);
      if (viz) send('high_viz', `${before.name} moved to ${patch.designPhase}`, `/design/${before.id}`);
    }
    if (patch.stage !== undefined && patch.stage && patch.stage !== before.stage) {
      send('construction_status', `${before.name} is now ${patch.stage}`, `/pm/${before.id}`);
      if (viz) send('high_viz', `${before.name} is now ${patch.stage}`, `/pm/${before.id}`);
    }
  }

  async remove(id: string) {
    const project = await this.repo.findOneBy({ id: Number(id) });
    if (project) await this.repo.remove(project);
    return { id: Number(id), deleted: true };
  }
}
