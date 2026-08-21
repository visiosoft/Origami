import { Injectable, OnApplicationBootstrap, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectTaskEntity, UserEntity } from '../database/entities';
import { DEFAULT_TASKS } from '../seed-data/project-tasks';
import { SectionsService } from './sections.service';
import {
  diffEvents, event, normalizeAttachments, normalizeList, subId,
  type ActivityEvent, type TaskAttachment, type TaskComment,
} from '../database/task.types';
import { backfillAssignees, resolveAssignee } from '../database/assignee.util';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';

@Injectable()
export class ProjectTasksService implements OnApplicationBootstrap {
  private readonly log = new Logger('ProjectTasksService');

  constructor(
    @InjectRepository(ProjectTaskEntity) private readonly repo: Repository<ProjectTaskEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly sections: SectionsService,
    private readonly attachments: AttachmentsService,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_TASKS as unknown as ProjectTaskEntity[]);
        this.log.log(`Seeded ${DEFAULT_TASKS.length} project tasks`);
      }
      await backfillAssignees(this.repo, this.users, 'assigneeId', 'assignee', this.log);
    } catch (err) {
      this.log.error('Task seed failed: ' + (err as Error).message);
    }
  }

  /** Fill in the json columns so the client never has to null-check them. */
  private hydrate(task: ProjectTaskEntity): ProjectTaskEntity {
    return {
      ...task,
      attachments: normalizeAttachments(task.attachments),
      comments: normalizeList<TaskComment>(task.comments),
      activity: normalizeList<ActivityEvent>(task.activity),
      checklist: normalizeList(task.checklist),
      labels: normalizeList<string>(task.labels),
      status: task.status || (task.completed ? 'Done' : 'Not started'),
    } as ProjectTaskEntity;
  }

  async findAll(projectId?: number): Promise<any[]> {
    const rows = await this.repo.find({ order: { order: 'ASC' } });
    const scoped = projectId ? rows.filter((t) => Number(t.projectId) === projectId) : rows;
    return scoped.map((t) => this.hydrate(t));
  }

  // { sections, tasks } for one project — the board payload.
  async board(projectId: number) {
    const sections = await this.sections.forProject(projectId);
    const tasks = await this.findAll(projectId);
    return { sections, tasks };
  }

  private async load(id: string) {
    const task = await this.repo.findOneBy({ id });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  /**
   * `status` and the older `completed` boolean describe the same thing, and both
   * are read in different places, so keep them consistent whichever one changed.
   */
  private syncStatus(task: ProjectTaskEntity, patch: Record<string, any>) {
    if ('status' in patch) {
      patch.completed = patch.status === 'Done';
    } else if ('completed' in patch) {
      const wasDone = (task.status || '') === 'Done';
      if (patch.completed) patch.status = 'Done';
      else if (wasDone || !task.status) patch.status = 'In progress';
    }
  }

  async create(dto: any, actor: UploadActor = { name: 'Unknown' }) {
    const id = dto.id || 'T-' + String(Date.now());
    const assignee = await resolveAssignee(this.users, { id: dto.assigneeId, name: dto.assignee });
    const task = {
      order: 0, completed: false, parentId: null, attachments: [], comments: [],
      createdAt: new Date().toISOString().slice(0, 10),
      ...dto,
      assignee: assignee.name,
      assigneeId: assignee.id ?? undefined,
      status: dto.status || (dto.completed ? 'Done' : 'Not started'),
      checklist: normalizeList(dto.checklist),
      labels: normalizeList<string>(dto.labels),
      activity: [event('created', actor, { text: 'created this task' })],
      updatedAt: new Date().toISOString(),
      projectId: Number(dto.projectId),
      id,
    };
    return this.hydrate(await this.repo.save(this.repo.create(task as Partial<ProjectTaskEntity>)));
  }

  async update(id: string, dto: any, actor: UploadActor = { name: 'Unknown' }) {
    let task = await this.repo.findOneBy({ id });
    if (!task) task = this.repo.create({ id, createdAt: new Date().toISOString().slice(0, 10) } as Partial<ProjectTaskEntity>);

    const patch: Record<string, any> = { ...dto };
    delete patch.id;

    if ('assignee' in patch || 'assigneeId' in patch) {
      const assignee = await resolveAssignee(this.users, { id: patch.assigneeId, name: patch.assignee });
      patch.assignee = assignee.name;
      patch.assigneeId = assignee.id ?? null;
    }
    this.syncStatus(task, patch);

    const events = diffEvents(task, patch, actor);
    Object.assign(task, patch, { id });
    task.activity = [...normalizeList<ActivityEvent>(task.activity), ...events];
    task.updatedAt = new Date().toISOString();
    return this.hydrate(await this.repo.save(task));
  }

  /** Persist a manual card order within one section (drag-to-reorder). */
  async reorder(sectionId: string, ids: string[]) {
    const rows = await this.repo.find({ where: { sectionId } });
    const byId = new Map(rows.map((t) => [t.id, t]));
    let position = 0;
    for (const id of ids) {
      const task = byId.get(id);
      if (!task) continue;
      task.order = position++;
      await this.repo.save(task);
    }
    return { sectionId, ordered: position };
  }

  // Move all tasks from one section to another (used when a section is deleted).
  async reparentTasks(fromSectionId: string, toSectionId: string) {
    await this.repo.update({ sectionId: fromSectionId }, { sectionId: toSectionId });
  }

  async deleteTasksInSection(sectionId: string) {
    await this.repo.delete({ sectionId });
  }

  async remove(id: string) {
    // Also remove subtasks of this task, and any files they own.
    const task = await this.repo.findOneBy({ id });
    if (task) {
      await this.attachments.discardAll(normalizeAttachments(task.attachments));
      await this.repo.remove(task);
    }
    const subs = await this.repo.find({ where: { parentId: id } });
    for (const sub of subs) await this.attachments.discardAll(normalizeAttachments(sub.attachments));
    if (subs.length) await this.repo.remove(subs);
    return { id, deleted: true };
  }

  // ------------------------------------------------------------- attachments

  private scopeFor(task: ProjectTaskEntity) {
    return `Project ${task.projectId}`;
  }

  async addAttachments(id: string, files: any[], actor: UploadActor) {
    const task = await this.load(id);
    const added = await this.attachments.upload(files, this.scopeFor(task), actor);
    task.attachments = [...normalizeAttachments(task.attachments), ...added];
    task.activity = [
      ...normalizeList<ActivityEvent>(task.activity),
      ...added.map((a) => event('attachment', actor, { text: `attached ${a.name}` })),
    ];
    task.updatedAt = new Date().toISOString();
    return this.hydrate(await this.repo.save(task));
  }

  async addLink(id: string, name: string, url: string, actor: UploadActor) {
    const task = await this.load(id);
    const att: TaskAttachment = { id: subId('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: new Date().toISOString() };
    task.attachments = [...normalizeAttachments(task.attachments), att];
    task.activity = [...normalizeList<ActivityEvent>(task.activity), event('attachment', actor, { text: `linked ${att.name}` })];
    return this.hydrate(await this.repo.save(task));
  }

  async removeAttachment(id: string, attId: string, actor: UploadActor) {
    const task = await this.load(id);
    const all = normalizeAttachments(task.attachments);
    const target = all.find((a) => a.id === attId);
    if (!target) throw new NotFoundException('Attachment not found');
    await this.attachments.discard(target);
    task.attachments = all.filter((a) => a.id !== attId);
    task.activity = [...normalizeList<ActivityEvent>(task.activity), event('attachment', actor, { text: `removed ${target.name}` })];
    return this.hydrate(await this.repo.save(task));
  }

  /** Look an attachment up on its own task — a Drive id alone is never enough. */
  async attachment(id: string, attId: string) {
    const task = await this.load(id);
    const att = normalizeAttachments(task.attachments).find((a) => a.id === attId);
    if (!att) throw new NotFoundException('Attachment not found');
    return att;
  }

  // ---------------------------------------------------------------- comments

  async addComment(id: string, text: string, actor: UploadActor) {
    const task = await this.load(id);
    if (!text?.trim()) throw new NotFoundException('Comment text is required');
    const comment: TaskComment = {
      id: subId('c'),
      author: actor.name,
      authorId: actor.id,
      text: text.trim(),
      date: new Date().toISOString(),
    };
    task.comments = [...normalizeList<TaskComment>(task.comments), comment];
    task.activity = [...normalizeList<ActivityEvent>(task.activity), event('comment', actor, { text: comment.text })];
    return this.hydrate(await this.repo.save(task));
  }
}
