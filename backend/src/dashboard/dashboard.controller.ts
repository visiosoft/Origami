import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tiers } from '../auth/guards/roles.decorator';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';
import { ProjectAccessService } from '../auth/project-access.service';
import { scopeTasks } from '../database/viewer.util';
import { ProjectEntity } from '../database/entities';
import { ProjectTasksService } from '../project-tasks/project-tasks.service';
import { TasksService } from '../tasks/tasks.service';
import { isClosedStatus } from '../tasks/log-statuses';
import { DashboardService } from './dashboard.service';
import { myTaskRows, taskSummary } from './task-summary';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly boardTasks: ProjectTasksService,
    private readonly logTasks: TasksService,
    private readonly access: ProjectAccessService,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
  ) {}

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
    const board = scopeTasks(await this.access.filter(claims, boardAll, (t: any) => t.projectId), claims);
    const log = scopeTasks(logAll, claims);
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
    const board = scopeTasks(await this.access.filter(claims, boardAll, (t: any) => t.projectId), claims);
    const log = scopeTasks(logAll, claims);
    const ids = [...new Set(board.map((t: any) => t.projectId).filter((x: any) => x != null))] as number[];
    const names = new Map((ids.length ? await this.projects.find({ where: { id: In(ids) }, select: { id: true, name: true } }) : []).map((p) => [p.id, p.name]));
    const day = /^\d{4}-\d{2}-\d{2}$/.test(today || '') ? today! : new Date().toISOString().slice(0, 10);
    return taskSummary(board, log, { id: claims?.sub || '', name: (claims?.name || '').trim() }, {
      today: day,
      projectName: (id) => (id == null ? 'General Tasks' : names.get(id) || `Project ${id}`),
      logClosed: (s) => s === 'Closed' || s === 'Complete' || s === 'Confirmed' || isClosedStatus(statuses, s),
    });
  }

  @Tiers('internal')
  @Get('kpis')
  getKpis() {
    return this.dashboardService.getKpis();
  }

  @Tiers('internal')
  @Get('budget-vs-spend')
  getBudgetVsSpend() {
    return this.dashboardService.getBudgetVsSpend();
  }

  @Tiers('internal')
  @Get('revenue-by-month')
  getRevenueByMonth() {
    return this.dashboardService.getRevenueByMonth();
  }

  @Tiers('internal')
  @Get('lead-funnel')
  getLeadFunnel() {
    return this.dashboardService.getLeadFunnel();
  }

  @Tiers('internal')
  @Get('workload')
  getWorkload() {
    return this.dashboardService.getWorkload();
  }
}
