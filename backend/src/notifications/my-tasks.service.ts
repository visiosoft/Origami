import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ProjectEntity, ProjectTaskEntity, TaskEntity } from '../database/entities';
import type { SessionClaims } from '../auth/crypto.util';

/**
 * What the notification bell lists: the caller's own board tasks and Special
 * Actions Log entries, a handful of fields each. The bell polls every couple of
 * minutes in every open tab, so it reads only the caller's rows rather than
 * every task with its whole history.
 */
@Injectable()
export class MyTasksService {
  constructor(
    @InjectRepository(ProjectTaskEntity) private readonly board: Repository<ProjectTaskEntity>,
    @InjectRepository(TaskEntity) private readonly log: Repository<TaskEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
  ) {}

  async list(claims: SessionClaims) {
    const name = (claims.name || '').trim();
    // Assigned by id, or -- for older rows with no id -- by name (the same rule as the task boards).
    const boardWhere: any[] = [{ assigneeId: claims.sub }];
    const logWhere: any[] = [{ assignedToId: claims.sub }];
    if (name) { boardWhere.push({ assigneeId: IsNull(), assignee: name }); logWhere.push({ assignedToId: IsNull(), assignedTo: name }); }
    const [boardRows, logRows] = await Promise.all([
      this.board.find({ where: boardWhere, select: { id: true, title: true, projectId: true, status: true, completed: true, archivedAt: true, updatedAt: true, createdAt: true } }),
      this.log.find({ where: logWhere, select: { id: true, subject: true, description: true, project: true, status: true, archivedAt: true, updatedAt: true } }),
    ]);
    const openBoard = boardRows.filter((t) => !t.completed && t.status !== 'Done' && !t.archivedAt);
    const ids = [...new Set(openBoard.map((t) => t.projectId).filter((x): x is number => x != null))];
    const names = new Map((ids.length ? await this.projects.find({ where: { id: In(ids) }, select: { id: true, name: true } }) : []).map((p) => [p.id, p.name]));
    return {
      board: openBoard.map((t) => ({ id: t.id, title: t.title, projectId: t.projectId, projectName: t.projectId != null ? names.get(t.projectId) ?? null : null, status: t.status, updatedAt: t.updatedAt, createdAt: t.createdAt })),
      log: logRows.filter((t) => !t.archivedAt).map((t) => ({ id: t.id, subject: t.subject, description: String(t.description || '').slice(0, 300), project: t.project, status: t.status, updatedAt: t.updatedAt })),
    };
  }
}
