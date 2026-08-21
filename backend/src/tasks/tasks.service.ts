import { Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity, UserEntity } from '../database/entities';
import {
  diffEvents, event, normalizeAttachments, normalizeList, subId,
  type ActivityEvent, type TaskAttachment, type TaskComment,
} from '../database/task.types';
import { backfillAssignees, resolveAssignee } from '../database/assignee.util';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';

const SCOPE = 'Request Log';

@Injectable()
export class TasksService implements OnApplicationBootstrap {
  private readonly log = new Logger('TasksService');

  constructor(
    @InjectRepository(TaskEntity) private readonly repo: Repository<TaskEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly attachments: AttachmentsService,
  ) {}

  async onApplicationBootstrap() {
    try {
      await backfillAssignees(this.repo, this.users, 'assignedToId', 'assignedTo', this.log);
    } catch (err) {
      this.log.error('Assignee backfill failed: ' + (err as Error).message);
    }
  }

  /** Fill in the json columns so the client never has to null-check them. */
  private hydrate(task: TaskEntity): TaskEntity {
    return {
      ...task,
      attachments: normalizeAttachments(task.attachments),
      comments: normalizeList<TaskComment>(task.comments),
      activity: normalizeList<ActivityEvent>(task.activity),
      checklist: normalizeList(task.checklist),
      labels: normalizeList<string>(task.labels),
    } as TaskEntity;
  }

  async findAll(tab?: string, project?: string) {
    const where: Record<string, string> = {};
    if (tab) where.tab = tab;
    if (project) where.project = project;
    const rows = await this.repo.find({ where });
    return rows.map((t) => this.hydrate(t));
  }

  async findOne(id: string) {
    const task = await this.repo.findOneBy({ id });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return this.hydrate(task);
  }

  private async load(id: string) {
    const task = await this.repo.findOneBy({ id });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  /**
   * Days between the meeting and either the close date or today.
   *
   * Only computed for real ISO dates: legacy rows store human strings like
   * "Apr 5", which Date.parse happily reads as the year 2001 and turns into a
   * nonsense age. Those keep whatever value they already had.
   */
  private daysOpen(task: TaskEntity): number {
    const iso = /^\d{4}-\d{2}-\d{2}/;
    const current = task.daysOpen ?? 0;
    if (!iso.test(task.meetingDate ?? '')) return current;
    const start = Date.parse(task.meetingDate);
    if (Number.isNaN(start)) return current;
    const end = task.dateClosed && iso.test(task.dateClosed) ? Date.parse(task.dateClosed) : Date.now();
    if (Number.isNaN(end)) return current;
    return Math.max(0, Math.round((end - start) / 86400000));
  }

  async create(dto: any, actor: UploadActor) {
    const rows = await this.repo.find();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq =
      rows
        .filter((t) => String(t.id).startsWith(dateStr + '-'))
        .reduce((max, t) => Math.max(max, parseInt(String(t.id).split('-')[1], 10) || 0), 0) + 1;
    const id = dto.id || `${dateStr}-${String(seq).padStart(2, '0')}`;

    const assignee = await resolveAssignee(this.users, { id: dto.assignedToId, name: dto.assignedTo });

    const task = this.repo.create({
      tab: 'internal',
      meetingType: 'Internal',
      meetingDate: new Date().toISOString().slice(0, 10),
      status: 'Open',
      topicType: 'Task',
      description: '',
      project: '',
      daysOpen: 0,
      ...dto,
      id,
      assignedTo: assignee.name,
      assignedToId: assignee.id ?? undefined,
      attachments: [],
      comments: [],
      checklist: normalizeList(dto.checklist),
      labels: normalizeList<string>(dto.labels),
      activity: [event('created', actor, { text: 'created this task' })],
      updatedAt: new Date().toISOString(),
    } as Partial<TaskEntity>);

    return this.hydrate(await this.repo.save(task));
  }

  /**
   * Patch a task. Records one activity entry per changed field, keeps
   * `daysOpen`/`dateClosed` consistent, and resolves the assignee to a user id.
   */
  async update(id: string, dto: any, actor: UploadActor) {
    const task = await this.load(id);
    const patch: Record<string, any> = { ...dto };
    delete patch.id;

    if ('assignedTo' in patch || 'assignedToId' in patch) {
      const assignee = await resolveAssignee(this.users, {
        id: patch.assignedToId,
        name: patch.assignedTo,
      });
      patch.assignedTo = assignee.name;
      patch.assignedToId = assignee.id ?? null;
    }

    // Closing a task stamps the close date; reopening clears it.
    if (patch.status === 'Closed' && task.status !== 'Closed' && !patch.dateClosed) {
      patch.dateClosed = new Date().toISOString().slice(0, 10);
    }
    if (patch.status && patch.status !== 'Closed') patch.dateClosed = '';

    const events = diffEvents(task, patch, actor);
    Object.assign(task, patch, { id });
    task.activity = [...normalizeList<ActivityEvent>(task.activity), ...events];
    task.daysOpen = this.daysOpen(task);
    task.updatedAt = new Date().toISOString();

    return this.hydrate(await this.repo.save(task));
  }

  async remove(id: string) {
    const task = await this.repo.findOneBy({ id });
    if (task) {
      await this.attachments.discardAll(normalizeAttachments(task.attachments));
      await this.repo.remove(task);
    }
    return { id, deleted: true };
  }

  // ------------------------------------------------------------- attachments

  async addAttachments(id: string, files: any[], actor: UploadActor) {
    const task = await this.load(id);
    const added = await this.attachments.upload(files, SCOPE, actor);
    task.attachments = [...normalizeAttachments(task.attachments), ...added];
    task.activity = [
      ...normalizeList<ActivityEvent>(task.activity),
      ...added.map((a) => event('attachment', actor, { text: `attached ${a.name}` })),
    ];
    task.updatedAt = new Date().toISOString();
    return this.hydrate(await this.repo.save(task));
  }

  /** Attach an external link rather than a stored file. */
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
