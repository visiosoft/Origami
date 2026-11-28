import { Controller, Get, Optional, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tiers } from '../auth/guards/roles.decorator';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';
import { ProjectAccessService } from '../auth/project-access.service';
import { onMyProjects, scopeTasks } from '../database/viewer.util';
import { localToday } from '../common/local-date';
import { ProjectEntity, RfiEntity, UserEntity } from '../database/entities';
import { todayPanel } from './today';
import { ProjectTasksService } from '../project-tasks/project-tasks.service';
import { TasksService } from '../tasks/tasks.service';
import { isClosedStatus } from '../tasks/log-statuses';
import { DashboardService } from './dashboard.service';
import { myTaskRows, taskSummary } from './task-summary';
import { Perm } from '../auth/guards/perm.guard';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly boardTasks: ProjectTasksService,
    private readonly logTasks: TasksService,
    private readonly access: ProjectAccessService,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @Optional() @InjectRepository(RfiEntity) private readonly rfis?: Repository<RfiEntity>,
    @Optional() @InjectRepository(UserEntity) private readonly users?: Repository<UserEntity>,
  ) {}

  /**
   * Nov 17: the dashboard's "Today" panel -- my Emergency / Urgent tasks, my tasks
   * due today or overdue, and my RFIs (my turn, due soon, past due). `today` is the viewer's day.
   */
  @Tiers('internal')
  @Get('today')
  async today(@Claims() claims: SessionClaims | null, @Query('today') today?: string) {
    const [boardAll, logAll, statuses] = await Promise.all([
      this.boardTasks.findAll(undefined, { slim: true }), this.logTasks.findAll(undefined, undefined, { slim: true }), this.logTasks.statuses(),
    ]);
    const board = scopeTasks(await this.access.filterOrMine(claims, boardAll as any[], (t: any) => t.projectId), claims);
    const log = onMyProjects(scopeTasks(logAll, claims), await this.access.allowedNames(claims), claims!);
    const ids = [...new Set(board.map((t: any) => t.projectId).filter((x: any) => x != null))] as number[];
    const names = new Map((ids.length ? await this.projects.find({ where: { id: In(ids) }, select: { id: true, name: true } }) : []).map((p) => [p.id, p.name]));
    const rfis = this.rfis && (await this.access.canView(claims, 'rfis')) ? await this.access.filter(claims, await this.rfis.find({ where: { status: In(['draft', 'open', 'answered']) } as any }), (r) => r.projectId) : [];
    const me = this.users && claims?.sub ? await this.users.findOneBy({ id: claims.sub }) : null;
    const day = /^\d{4}-\d{2}-\d{2}$/.test(today || '') ? today! : localToday();
    return todayPanel(board as any[], log as any[], rfis as any, { id: claims?.sub || '', email: me?.email || claims?.email || '', altEmails: (me as any)?.altEmails || [], name: (claims?.name || '').trim() }, {
      today: day,
      projectName: (id) => (id == null ? 'General Tasks' : names.get(id) || `Project ${id}`),
      logClosed: (s) => s === 'Closed' || s === 'Complete' || s === 'Confirmed' || isClosedStatus(statuses, s),
    });
  }

  /**
   * "My Tasks" (every dashboard, clients' and consultants' too): the caller's
   * open board tasks and log entries -- assigned or collaborating -- soonest
   * due first. `limit` rows (8 by default) and the total.
   */
  @Get('my-tasks')
  async myTasks(@Claims() claims: SessionClaims | null, @Query('limit') limit?: string) {
    const [boardAll, logAll, statuses] = await Promise.all([
      this.boardTasks.findAll(undefined, { slim: true }), this.logTasks.findAll(undefined, undefined, { slim: true }), this.logTasks.statuses(),
    ]);
    const board = scopeTasks(await this.access.filterOrMine(claims, boardAll as any[], (t: any) => t.projectId), claims);
    // Request Log entries too keep to the caller's projects (Nov 17: View as showed other projects' items).
    const log = onMyProjects(scopeTasks(logAll, claims), await this.access.allowedNames(claims), claims!);
    const ids = [...new Set(board.map((t: any) => t.projectId).filter((x: any) => x != null))] as number[];
    const names = new Map((ids.length ? await this.projects.find({ where: { id: In(ids) }, select: { id: true, name: true } }) : []).map((p) => [p.id, p.name]));
    return myTaskRows(board, log, { id: claims?.sub || '', name: (claims?.name || '').trim() }, {
      limit: Math.min(50, Math.max(1, Number(limit) || 8)),
      projectName: (id) => (id == null ? 'General Tasks' : names.get(id) || `Project ${id}`),
      logClosed: (s) => s === 'Closed' || s === 'Complete' || s === 'Confirmed' || isClosedStatus(statuses, s),
    });
  }

  /**
   * The Dashboard's task cards in one small answer (due/overdue strip, my
   * tasks, team workload, projects with overdue tasks) -- worked out here from
   * the in-memory task lists instead of sending the page every task.
   * `today` is the viewer's own date (YYYY-MM-DD).
   */
  @Tiers('internal')
  @Get('tasks-summary')
  async tasksSummary(@Claims() claims: SessionClaims | null, @Query('today') today?: string) {
    const [boardAll, logAll, statuses] = await Promise.all([
      this.boardTasks.findAll(undefined, { slim: true }), this.logTasks.findAll(undefined, undefined, { slim: true }), this.logTasks.statuses(),
    ]);
    const board = scopeTasks(await this.access.filterOrMine(claims, boardAll as any[], (t: any) => t.projectId), claims);
    // Request Log entries too keep to the caller's projects (Nov 17: View as showed other projects' items).
    const log = onMyProjects(scopeTasks(logAll, claims), await this.access.allowedNames(claims), claims!);
    const ids = [...new Set(board.map((t: any) => t.projectId).filter((x: any) => x != null))] as number[];
    const names = new Map((ids.length ? await this.projects.find({ where: { id: In(ids) }, select: { id: true, name: true } }) : []).map((p) => [p.id, p.name]));
    const day = /^\d{4}-\d{2}-\d{2}$/.test(today || '') ? today! : localToday();
    return taskSummary(board, log, { id: claims?.sub || '', name: (claims?.name || '').trim() }, {
      today: day,
      projectName: (id) => (id == null ? 'General Tasks' : names.get(id) || `Project ${id}`),
      logClosed: (s) => s === 'Closed' || s === 'Complete' || s === 'Confirmed' || isClosedStatus(statuses, s),
    });
  }

  @Tiers('internal')
  @Perm('fin_project', 'fin_business')
  @Get('kpis')
  getKpis() {
    return this.dashboardService.getKpis();
  }

  @Tiers('internal')
  @Perm('fin_project', 'fin_business')
  @Get('budget-vs-spend')
  getBudgetVsSpend() {
    return this.dashboardService.getBudgetVsSpend();
  }

  @Tiers('internal')
  @Perm('fin_project', 'fin_business')
  @Get('revenue-by-month')
  getRevenueByMonth() {
    return this.dashboardService.getRevenueByMonth();
  }

  @Tiers('internal')
  @Perm('pipeline', 'crm_holding')
  @Get('lead-funnel')
  async getLeadFunnel(@Claims() claims: SessionClaims | null) {
    // Company-wide figures: not for "Assigned projects" accounts (Nov 10).
    if ((await this.access.allowedIds(claims)) !== 'all') return [];
    return this.dashboardService.getLeadFunnel();
  }

  @Tiers('internal')
  @Perm('tasks', 'people')
  @Get('workload')
  async getWorkload(@Claims() claims: SessionClaims | null) {
    if ((await this.access.allowedIds(claims)) !== 'all') return [];
    return this.dashboardService.getWorkload();
  }
}
