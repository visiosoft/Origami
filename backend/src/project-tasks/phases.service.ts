import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectPhaseEntity, ProjectTaskEntity, ProjectEntity } from '../database/entities';
import { PHASE_DEFINITIONS, RETIRED_PHASE_KEYS, DEMO_PHASE_TASKS, TEMPLATE_STATUS } from '../seed-data/project-phases';
import { SectionsService } from './sections.service';
import { event, subId } from '../database/task.types';

/**
 * The project whose Phase Board keeps the old hardcoded programme, so that
 * screen still demonstrates a full delivery cycle. Every other project starts
 * with empty phases.
 */
const DEMO_PROJECT_ID = 1;

/** Board sections a phase task is filed under, by status. */
const SECTION_FOR_STATUS: Record<string, number> = {
  'Not started': 0,   // To Do
  'In progress': 1,   // In Progress
  Blocked: 1,
  Done: 3,            // Done
};

@Injectable()
export class PhasesService implements OnApplicationBootstrap {
  private readonly log = new Logger('PhasesService');

  constructor(
    @InjectRepository(ProjectPhaseEntity) private readonly repo: Repository<ProjectPhaseEntity>,
    @InjectRepository(ProjectTaskEntity) private readonly tasks: Repository<ProjectTaskEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly sections: SectionsService,
  ) {}

  /**
   * Drop phases that are no longer part of the programme.
   *
   * Their tasks are unfiled rather than deleted -- they return to the project's
   * kanban as ad-hoc work instead of vanishing with the column.
   */
  async onApplicationBootstrap() {
    try {
      const stale = await this.repo.find();
      const retired = stale.filter((ph) => RETIRED_PHASE_KEYS.includes(ph.key));
      if (!retired.length) return;

      const ids = retired.map((ph) => ph.id);
      const orphans = (await this.tasks.find()).filter((t) => t.phaseId && ids.includes(t.phaseId));
      if (orphans.length) {
        for (const task of orphans) task.phaseId = null as unknown as string;
        await this.tasks.save(orphans);
        this.log.log(`Unfiled ${orphans.length} task(s) from retired phases`);
      }
      await this.repo.remove(retired);
      this.log.log(`Removed ${retired.length} retired phase row(s)`);
    } catch (err) {
      this.log.warn('Retired phase cleanup failed: ' + (err as Error).message);
    }
  }

  /**
   * Every project's design progress in one call, for the Design board.
   *
   * Per project it returns the phases with their task counts and the phase the
   * work has actually reached — the first with unfinished tasks, so a project
   * shows up in the column somebody is working in rather than the one it was
   * filed under. Done in one pass instead of a request per project.
   */
  async overview() {
    const [projects, phases, tasks] = await Promise.all([
      this.projects.find({ order: { id: 'ASC' } }),
      this.repo.find({ order: { order: 'ASC' } }),
      this.tasks.find(),
    ]);

    // Only phase tasks count towards a phase; ad-hoc board tasks don't.
    const byPhase = new Map<string, { total: number; done: number }>();
    for (const task of tasks) {
      if (!task.phaseId || task.parentId) continue;
      const bucket = byPhase.get(task.phaseId) || { total: 0, done: 0 };
      bucket.total += 1;
      if (task.completed || task.status === 'Done') bucket.done += 1;
      byPhase.set(task.phaseId, bucket);
    }

    return projects.map((project) => {
      const rows = phases.filter((ph) => Number(ph.projectId) === Number(project.id) && !RETIRED_PHASE_KEYS.includes(ph.key));
      const byKey = new Map(rows.map((ph) => [ph.key, ph]));

      // Every standard phase, whether or not a row exists for it: rows are only
      // written when someone opens a project's Phase Board, and a phase added
      // to the programme later has no row on older projects. Reading creates
      // nothing. Phases a team added themselves are appended.
      const source = [
        ...PHASE_DEFINITIONS.map((d) => {
          const row = byKey.get(d.key);
          return row ?? { id: `PH-${project.id}-${d.key}`, key: d.key, name: d.name, color: d.color, order: d.order };
        }),
        ...rows.filter((ph) => !PHASE_DEFINITIONS.some((d) => d.key === ph.key)),
      ].sort((a, b) => a.order - b.order);

      const own = source
        .map((ph) => {
          const c = byPhase.get(ph.id) || { total: 0, done: 0 };
          return {
            id: ph.id, key: ph.key, name: ph.name, color: ph.color, order: ph.order,
            total: c.total, done: c.done,
            progress: c.total ? Math.round((c.done / c.total) * 100) : 0,
            complete: c.total > 0 && c.done === c.total,
          };
        });

      // An explicit drag wins over the derived position, as long as the phase
      // still exists -- a retired phase falls back to the derived one.
      const pinned = own.find((ph) => ph.key === project.designPhase);
      const started = own.filter((ph) => ph.total > 0);
      // The first phase with work outstanding; if everything is done, the last
      // one that had work; if nothing has been planned yet, the first phase.
      const current = pinned
        ?? started.find((ph) => !ph.complete)
        ?? started[started.length - 1]
        ?? own[0];

      const total = own.reduce((sum, ph) => sum + ph.total, 0);
      const done = own.reduce((sum, ph) => sum + ph.done, 0);

      return {
        projectId: Number(project.id),
        name: project.name,
        stage: project.stage,
        priority: project.priority,
        contractAmt: project.contractAmt,
        location: project.location,
        typeOfWork: project.typeOfWork,
        imgColor: project.imgColor,
        contractType: project.contractType,
        estStart: project.estStart,
        duration: project.duration,
        scope: project.scope,
        referral: project.referral,
        projectProgress: project.progress,
        currentPhaseKey: current?.key ?? null,
        phases: own,
        taskTotal: total,
        taskDone: done,
        progress: total ? Math.round((done / total) * 100) : 0,
      };
    });
  }

  /**
   * A project's phases, creating the standard six the first time it's opened.
   * Mirrors SectionsService.forProject, which lazily creates board sections.
   */
  async forProject(projectId: number): Promise<ProjectPhaseEntity[]> {
    if (!Number.isFinite(projectId)) return [];
    // Don't create phases for a project that isn't there.
    if (!(await this.projects.findOneBy({ id: projectId }))) return [];

    const existing = await this.repo.find({ where: { projectId }, order: { order: 'ASC' } });
    if (existing.length) {
      // A phase added to the programme after this project was created has no
      // row yet, so fill in the gaps rather than leaving the board short.
      const missing = PHASE_DEFINITIONS.filter((d) => !existing.some((ph) => ph.key === d.key));
      if (missing.length) {
        const added = await this.repo.save(missing.map((d) => this.repo.create({
          id: `PH-${projectId}-${d.key}`, projectId, key: d.key, name: d.name, color: d.color, order: d.order,
        } as Partial<ProjectPhaseEntity>)));
        this.log.log(`Added ${added.length} new phase(s) to project ${projectId}`);
        existing.push(...added);
        existing.sort((a, b) => a.order - b.order);
      }
      await this.seedDemoTasks(projectId, existing);
      return existing;
    }

    const created = PHASE_DEFINITIONS.map((d) =>
      this.repo.create({
        id: `PH-${projectId}-${d.key}`,
        projectId,
        key: d.key,
        name: d.name,
        color: d.color,
        order: d.order,
      } as Partial<ProjectPhaseEntity>),
    );
    await this.repo.save(created);
    this.log.log(`Created ${created.length} phases for project ${projectId}`);

    await this.seedDemoTasks(projectId, created);
    return this.repo.find({ where: { projectId }, order: { order: 'ASC' } });
  }

  async board(projectId: number) {
    const phases = await this.forProject(projectId);
    const rows = await this.tasks.find({ order: { order: 'ASC' } });
    const tasks = rows.filter((t) => Number(t.projectId) === projectId && !!t.phaseId);
    return { phases, tasks };
  }

  create(dto: any) {
    const projectId = Number(dto.projectId);
    const id = dto.id || `PH-${projectId}-${subId('p')}`;
    return this.repo.save(
      this.repo.create({
        color: '#173326',
        order: 0,
        key: id,
        name: 'New Phase',
        ...dto,
        projectId,
        id,
      } as Partial<ProjectPhaseEntity>),
    );
  }

  async update(id: string, dto: any) {
    const phase = await this.repo.findOneBy({ id });
    if (!phase) throw new NotFoundException(`Phase ${id} not found`);
    Object.assign(phase, dto, { id });
    return this.repo.save(phase);
  }

  /** Removing a phase keeps its tasks — they just become ad-hoc board tasks. */
  async remove(id: string) {
    const phase = await this.repo.findOneBy({ id });
    if (!phase) return { id, deleted: true };
    await this.tasks.update({ phaseId: id }, { phaseId: null as any });
    await this.repo.remove(phase);
    return { id, deleted: true };
  }

  // ------------------------------------------------------------------ demo

  /**
   * Fill the demo project's phases with the programme that used to be hardcoded
   * in the frontend. Runs once — any existing phase task means it's already done.
   */
  private async seedDemoTasks(projectId: number, phases: ProjectPhaseEntity[]) {
    if (projectId !== DEMO_PROJECT_ID) return;
    // Only ever seed a project that actually exists — asking for the board of a
    // deleted or bogus id must not conjure a programme for it.
    if (!(await this.projects.findOneBy({ id: projectId }))) return;
    const already = await this.tasks.count({ where: { projectId, phaseId: phases[0]?.id } });
    if (already > 0) return;
    const anyPhaseTask = (await this.tasks.find({ where: { projectId } })).some((t) => !!t.phaseId);
    if (anyPhaseTask) return;

    const start = await this.projectStart(projectId);
    const sections = await this.sections.forProject(projectId);
    const phaseByKey = new Map(phases.map((p) => [p.key, p]));

    const byTitle = new Map<string, string>();
    const rows: ProjectTaskEntity[] = [];

    DEMO_PHASE_TASKS.forEach((tpl, index) => {
      const phase = phaseByKey.get(tpl.phaseKey);
      if (!phase) return;
      const status = TEMPLATE_STATUS[tpl.status] || 'Not started';
      const sectionIdx = SECTION_FOR_STATUS[status] ?? 0;
      const startDate = this.addDays(start, tpl.offsetDays);
      const endDate = tpl.durationDays == null ? '' : this.addDays(start, tpl.offsetDays + Math.max(0, tpl.durationDays - 1));
      const id = `T-${projectId}-${String(index + 1).padStart(3, '0')}`;
      byTitle.set(tpl.title, id);

      rows.push(
        this.tasks.create({
          id,
          projectId,
          sectionId: (sections[sectionIdx] ?? sections[0])?.id ?? `S-${projectId}-0`,
          phaseId: phase.id,
          title: tpl.title,
          status,
          completed: status === 'Done',
          team: tpl.team,
          auto: tpl.auto,
          autoLabel: tpl.autoLabel ?? '',
          startDate,
          endDate,
          durationDays: tpl.durationDays ?? (null as any),
          order: index,
          parentId: null as any,
          attachments: [],
          comments: [],
          checklist: [],
          labels: [],
          activity: [event('created', { name: 'Origami' }, { text: 'created from the project programme' })],
          createdAt: new Date().toISOString().slice(0, 10),
        } as Partial<ProjectTaskEntity>),
      );
    });

    // Second pass: dependencies are authored as titles, resolved to ids here.
    for (const row of rows) {
      const tpl = DEMO_PHASE_TASKS.find((t) => t.title === row.title);
      row.dependsOn = (tpl?.deps ?? []).map((d) => byTitle.get(d)).filter(Boolean) as string[];
    }

    await this.tasks.save(rows);
    await this.stampPhaseDates(phases, rows);
    this.log.log(`Seeded ${rows.length} programme tasks for the demo project`);
  }

  /** Give each phase the span of its tasks, for the board header. */
  private async stampPhaseDates(phases: ProjectPhaseEntity[], rows: ProjectTaskEntity[]) {
    for (const phase of phases) {
      const mine = rows.filter((r) => r.phaseId === phase.id && r.startDate);
      if (!mine.length) continue;
      phase.startDate = mine.map((r) => r.startDate).sort()[0];
      phase.endDate = mine.map((r) => r.endDate || r.startDate).sort().slice(-1)[0];
    }
    await this.repo.save(phases);
  }

  /**
   * A project's start date. `estStart` is not ISO — the seed holds values like
   * 'Sep 2025' — so accept both and fall back to today.
   */
  private async projectStart(projectId: number): Promise<Date> {
    const project = await this.projects.findOneBy({ id: projectId });
    const raw = (project?.estStart || '').trim();

    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));

    // Values like 'Sep 2025'. Build in UTC — a local-midnight Date serialises to
    // the previous day for anyone behind UTC.
    const monthYear = /^([A-Za-z]{3,})\s+(\d{4})$/.exec(raw);
    if (monthYear) {
      const month = new Date(`${monthYear[1]} 1, 2000`).getMonth();
      if (!Number.isNaN(month)) return new Date(Date.UTC(+monthYear[2], month, 1));
    }

    // 'Ongoing' and anything else unparseable: start from today.
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private addDays(from: Date, days: number): string {
    const d = new Date(from.getTime());
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }
}
