import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyLogEntity, LaborLogEntryEntity, ProjectEntity } from '../database/entities';

/** A read-only rollup of an employee's logged hours over a date range -- no separate storage or approval of its own. */
@Injectable()
export class TimesheetsService {
  constructor(
    @InjectRepository(DailyLogEntity) private readonly logs: Repository<DailyLogEntity>,
    @InjectRepository(LaborLogEntryEntity) private readonly entries: Repository<LaborLogEntryEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
  ) {}

  async forEmployee(employeeId: string, from: string, to: string) {
    const logsInRange = await this.logs
      .createQueryBuilder('log')
      .where('log.date >= :from AND log.date <= :to', { from, to })
      .getMany();
    if (!logsInRange.length) return { rows: [], totalHours: 0 };

    const byLogId = new Map(logsInRange.map((l) => [l.id, l]));
    const allEntries = await this.entries.find({ where: logsInRange.map((l) => ({ dailyLogId: l.id })) });
    const mine = allEntries.filter((e) => e.employeeId === employeeId);
    if (!mine.length) return { rows: [], totalHours: 0 };

    const projectIds = Array.from(new Set(mine.map((e) => byLogId.get(e.dailyLogId)?.projectId).filter((x): x is number => x != null)));
    const projects = projectIds.length ? await this.projects.findBy(projectIds.map((id) => ({ id }))) : [];
    const projectName = new Map(projects.map((p) => [p.id, p.name]));

    const rows = mine.map((e) => {
      const log = byLogId.get(e.dailyLogId)!;
      return {
        date: log.date,
        projectId: log.projectId,
        projectName: projectName.get(log.projectId) || `Project ${log.projectId}`,
        csiCodeId: e.csiCodeId,
        hours: e.hours || 0,
        taskDetail: e.taskDetail,
        status: log.status, // draft/submitted/approved/rejected -- lets the UI flag unapproved hours
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    const totalHours = rows.reduce((sum, r) => sum + (r.hours || 0), 0);
    return { rows, totalHours };
  }
}
