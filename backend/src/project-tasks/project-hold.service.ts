import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity, ProjectTaskEntity, UserEntity } from '../database/entities';
import type { UploadActor } from '../google/attachments.service';
import { ProjectTasksService } from './project-tasks.service';

export const HOLD_TASK_LABEL = 'kind:hold-follow-up';

export interface HoldInput {
  /** YYYY-MM-DD -- when to check back. */
  until: string;
  reason?: string;
  /** Who follows up; defaults to whoever put it on hold. */
  followUpId?: string;
}

/** "Oct 25, 2026" for a task title / history line. */
export const holdDate = (d: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : d;
};

/** The follow-up task's wording -- what's parked, since when, why. */
export function holdTaskText(project: { name: string }, input: { until: string; reason?: string }, since: string, by: string) {
  const reason = (input.reason || '').trim();
  return {
    title: `Follow up: ${project.name} is on hold`,
    description: [
      `Put on hold ${holdDate(since.slice(0, 10))} by ${by}.`,
      reason ? `Reason: ${reason}` : '',
      `Check in with the client and either resume the project or push the follow-up date.`,
    ].filter(Boolean).join('\n'),
  };
}

/**
 * A project parked without leaving its stage, the way a lead goes on hold --
 * plus the follow-up task, so picking it back up is on somebody's list
 * (and in their due-date reminder email) rather than in someone's head.
 */
@Injectable()
export class ProjectHoldService {
  constructor(
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(ProjectTaskEntity) private readonly taskRepo: Repository<ProjectTaskEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly tasks: ProjectTasksService,
  ) {}

  private async project(id: number) {
    const p = await this.projects.findOneBy({ id });
    if (!p) throw new NotFoundException('Project not found');
    return p;
  }

  /** Put on hold, or change an existing hold's date / reason / who follows up. */
  async hold(projectId: number, input: HoldInput, actor: UploadActor) {
    const until = String(input?.until || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new BadRequestException('Pick the date to follow up.');
    const reason = String(input?.reason || '').trim().slice(0, 2000);
    const project = await this.project(projectId);
    const followUp = (input?.followUpId && (await this.users.findOneBy({ id: input.followUpId })))
      || (actor.id ? await this.users.findOneBy({ id: actor.id }) : null);

    const changing = !!project.holdSince;
    const since = project.holdSince || new Date().toISOString();
    const text = holdTaskText(project, { until, reason }, since, changing ? project.holdBy || actor.name : actor.name);

    // One follow-up task per hold: reuse it while it's still open, else start a new one.
    const existing = project.holdTaskId ? await this.taskRepo.findOneBy({ id: project.holdTaskId }) : null;
    let taskId: string;
    if (existing && existing.status !== 'Done' && !existing.completed) {
      await this.tasks.update(existing.id, {
        title: text.title, description: text.description, dueDate: until,
        ...(followUp ? { assigneeId: followUp.id, assignee: followUp.name } : {}),
      }, actor);
      taskId = existing.id;
    } else {
      const created = await this.tasks.create({
        id: `T-HOLD-${projectId}-${Date.now()}`,
        projectId, title: text.title, description: text.description, dueDate: until,
        priority: 'Medium', labels: [HOLD_TASK_LABEL],
        assigneeId: followUp?.id, assignee: followUp?.name,
      }, actor);
      taskId = created.id;
    }

    project.holdSince = since;
    project.holdUntil = until;
    project.holdReason = reason;
    project.holdBy = changing ? project.holdBy || actor.name : actor.name;
    project.holdTaskId = taskId;
    project.holdHistory = [...(project.holdHistory || []), {
      action: changing ? 'changed' : 'hold', at: new Date().toISOString(), by: actor.name, until, reason, followUp: followUp?.name,
    }];
    return this.projects.save(project);
  }

  /** Back to work: the hold clears and its follow-up task is ticked off. */
  async resume(projectId: number, actor: UploadActor) {
    const project = await this.project(projectId);
    if (!project.holdSince) return project;
    if (project.holdTaskId) {
      const task = await this.taskRepo.findOneBy({ id: project.holdTaskId });
      if (task && task.status !== 'Done' && !task.completed) await this.tasks.update(task.id, { status: 'Done' }, actor);
    }
    project.holdHistory = [...(project.holdHistory || []), { action: 'resumed', at: new Date().toISOString(), by: actor.name }];
    project.holdSince = '';
    project.holdUntil = '';
    project.holdReason = '';
    project.holdBy = '';
    project.holdTaskId = '';
    return this.projects.save(project);
  }
}
