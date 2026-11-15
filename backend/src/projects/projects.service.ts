import { SettingsService } from '../settings/settings.service';
import { ARCHIVE_AFTER_DAYS, archiveDue, archivePlan } from './project-archive';
import { renamedPeople } from '../people/person-projects';
import { BadRequestException, Injectable, Optional, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { cleanProjectCode, projectCodes } from '../database/serials';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotifyHub } from '../notifications/notify-hub.service';
import { PersonEntity, ProjectEntity } from '../database/entities';

const AUTO_ARCHIVE_KEY = 'projects.autoArchive';

@Injectable()
export class ProjectsService implements OnApplicationBootstrap {
  private readonly log = new Logger('ProjectsService');

  constructor(
    @InjectRepository(ProjectEntity) private readonly repo: Repository<ProjectEntity>,
    @Optional() private readonly hub?: NotifyHub,
    @Optional() @InjectRepository(PersonEntity) private readonly people?: Repository<PersonEntity>,
    @Optional() private readonly settings?: SettingsService,
  ) {}

  /** The "Leads" stage was renamed to "Kickoff" -- carry any row saved under the old name forward. */
  async onApplicationBootstrap() {
    // Closed-out / cancelled projects to the archive (Nov 13), hourly once switched on.
    const sweep = setInterval(() => { void this.archiveSweep().catch((e: Error) => this.log.warn('Archive sweep failed: ' + e.message)); }, 60 * 60_000);
    sweep.unref?.();
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

  /** Every project, with `taskCode`: the prefix its task numbers carry (set by hand, or made from the name). */
  async findAll(archived: 'hide' | 'only' | 'all' = 'hide') {
    const rows = (await this.repo.find({ order: { id: 'ASC' } })).filter((p) => archived === 'all' || (archived === 'only' ? !!p.archivedAt : !p.archivedAt));
    const codes = projectCodes(rows);
    return rows.map((p) => Object.assign(p, { taskCode: codes.get(p.id) }));
  }

  async findOne(id: string) {
    const project = await this.repo.findOneBy({ id: Number(id) });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    const codes = projectCodes(await this.repo.find({ select: { id: true, name: true, code: true } }));
    return Object.assign(project, { taskCode: codes.get(project.id) });
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
    // The task-number prefix: clean, and not another project's (blank goes back to the one made from the name).
    if ('code' in patch) {
      const code = cleanProjectCode(patch.code);
      if (patch.code && !code) throw new BadRequestException('A project code is 2 to 8 letters or digits.');
      if (code) {
        const others = (await this.repo.find({ select: { id: true, name: true, code: true } })).filter((p) => p.id !== Number(id));
        if (projectCodes(others).size && [...projectCodes(others).values()].includes(code)) throw new BadRequestException(`${code} is already another project's code.`);
      }
      patch.code = code || null;
    }
    // Archive (Nov 13): set only through archive / restore; a stage change starts the 10-day count.
    delete patch.archivedAt; delete patch.stageChangedAt;
    if (patch.kind !== undefined && patch.kind !== 'internal') patch.kind = null;
    const before = this.hub || ('name' in patch && this.people) || 'stage' in patch ? await this.repo.findOneBy({ id: Number(id) }) : null;
    if (before && patch.stage && patch.stage !== before.stage) patch.stageChangedAt = new Date().toISOString();
    await this.repo.update({ id: Number(id) }, patch as Partial<ProjectEntity>);
    if (before && this.hub) this.statusNotices(before, patch, actor);
    // Renamed: everyone on it shows the new name; their link (the project id) doesn't change (Nov 13).
    if (before && this.people && typeof patch.name === 'string' && patch.name !== before.name) {
      for (const p of renamedPeople(await this.people.find(), before.id, before.name, patch.name)) await this.people.save(p);
    }
    return this.findOne(id);
  }

  // ------------------------------------------------------------ archive (Nov 13 sync)
  private autoOn = async () => (await this.settings?.get(AUTO_ARCHIVE_KEY)) === '1';

  /** What switching auto-archive on would do (preview), and whether it's on. */
  async archivePreview() {
    return { on: await this.autoOn(), afterDays: ARCHIVE_AFTER_DAYS, ...archivePlan(await this.repo.find()) };
  }

  /** Apply: archive the due ones, start the count today for undated ones, and keep doing it hourly. */
  async applyArchive(now = Date.now()) {
    const plan = archivePlan(await this.repo.find(), now);
    const at = new Date(now).toISOString();
    for (const p of plan.due) await this.repo.update({ id: p.id }, { archivedAt: at });
    for (const p of plan.undated) await this.repo.update({ id: p.id }, { stageChangedAt: at });
    await this.settings?.set(AUTO_ARCHIVE_KEY, '1');
    return { archived: plan.due.length, counting: plan.undated.length };
  }

  /** Hourly while switched on. */
  async archiveSweep(now = Date.now()) {
    if (!(await this.autoOn())) return 0;
    const due = (await this.repo.find()).filter((p) => archiveDue(p, now));
    const at = new Date(now).toISOString();
    for (const p of due) await this.repo.update({ id: p.id }, { archivedAt: at });
    if (due.length) this.log.log(`Archived ${due.length} closed / cancelled project(s)`);
    return due.length;
  }

  async setArchived(id: string, archived: boolean) {
    const p = await this.repo.findOneBy({ id: Number(id) });
    if (!p) throw new NotFoundException(`Project ${id} not found`);
    // Restored: the 10 days start again from today, so it isn't archived again straight away.
    await this.repo.update({ id: p.id }, archived ? { archivedAt: new Date().toISOString() } : { archivedAt: null, stageChangedAt: new Date().toISOString() });
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
