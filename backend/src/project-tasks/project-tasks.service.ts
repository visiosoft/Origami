import { BadRequestException, Injectable, OnApplicationBootstrap, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistTemplateEntity, ProjectTaskEntity, UserEntity } from '../database/entities';
import { withAutoChecklists } from './auto-checklist';
import { DEFAULT_TASKS } from '../seed-data/project-tasks';
import { SectionsService } from './sections.service';
import {
  diffEvents, event, normalizeAttachments, normalizeList, subId,
  type ActivityEvent, type TaskAttachment, type TaskComment,
  normalizeCollaborators, collaboratorChanges, normalizeTaskStatus, bucketStatus, isDoneStatus,
} from '../database/task.types';
import { backfillAssignees, resolveAssignee } from '../database/assignee.util';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { backfillSerials, nextSerial, serialYear } from '../database/serials';

/** Days a Confirmed task stays on the board before it's archived. */
export const ARCHIVE_AFTER_DAYS = 7;

@Injectable()
export class ProjectTasksService implements OnApplicationBootstrap {
  private readonly log = new Logger('ProjectTasksService');

  constructor(
    @InjectRepository(ProjectTaskEntity) private readonly repo: Repository<ProjectTaskEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly sections: SectionsService,
    private readonly attachments: AttachmentsService,
    private readonly notifications: NotificationsService,
    @Optional() @InjectRepository(ChecklistTemplateEntity) private readonly checklistTemplates?: Repository<ChecklistTemplateEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_TASKS as unknown as ProjectTaskEntity[]);
        this.log.log(`Seeded ${DEFAULT_TASKS.length} project tasks`);
      }
      await backfillAssignees(this.repo, this.users, 'assigneeId', 'assignee', this.log);
      await this.renameLegacyTitles();
      // "Blocked" became "On hold" -- carry saved tasks across once.
      const blocked = await this.repo.findBy({ status: 'Blocked' });
      if (blocked.length) {
        for (const t of blocked) t.status = 'On hold';
        await this.repo.save(blocked);
        this.log.log(`Renamed ${blocked.length} task status(es) Blocked -> On hold`);
      }
    } catch (err) {
      this.log.error('Task seed failed: ' + (err as Error).message);
    }
    try {
      const rows = await this.repo.find();
      const pairs = backfillSerials(rows, (t) => String(t.projectId ?? ''), () => 'task', (t) => t.createdAt);
      for (const [id, serial] of pairs) await this.repo.update({ id }, { serial });
      if (pairs.length) this.log.log(`Gave ${pairs.length} board task(s) a serial number`);
    } catch (err) {
      this.log.error('Board task serial numbers failed: ' + (err as Error).message);
    }
  }

  /**
   * Rename tasks whose titles have changed since they were seeded.
   *
   * Renaming the seed only affects fresh databases; rows already saved keep the
   * old wording forever otherwise. Idempotent — it only matches the old title.
   */
  private async renameLegacyTitles() {
    const RENAMES: [string, string][] = [
      ['Press Release & Project Info', 'Project Info'],
    ];
    for (const [from, to] of RENAMES) {
      const rows = await this.repo.findBy({ title: from });
      if (!rows.length) continue;
      for (const row of rows) row.title = to;
      await this.repo.save(rows);
      this.log.log(`Renamed ${rows.length} task(s): "${from}" -> "${to}"`);
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
      dependsOn: normalizeList<string>(task.dependsOn),
      status: task.status || (task.completed ? 'Done' : 'Not started'),
    } as ProjectTaskEntity;
  }

  /** Confirmed tasks are archived 7 days later -- worked out whenever tasks are read. */
  private async archiveConfirmed(rows: ProjectTaskEntity[]) {
    const cutoff = Date.now() - ARCHIVE_AFTER_DAYS * 86400000;
    const due = rows.filter((t) => t.status === 'Confirmed' && !t.archivedAt && t.confirmedAt && Date.parse(t.confirmedAt) <= cutoff);
    if (!due.length) return;
    const at = new Date().toISOString();
    for (const t of due) t.archivedAt = at;
    await this.repo.save(due).catch((e) => this.log.warn('Archiving confirmed tasks failed: ' + (e as Error).message));
  }

  /**
   * `undefined` = every task across every project + General Tasks (used by
   * My Tasks, Notifications, the dashboard's attention strip -- callers that
   * genuinely want everything). `null` = only the General Tasks board (not
   * tied to any client project). A number = that project only.
   */
  async findAll(projectId?: number | null): Promise<any[]> {
    const rows = await this.repo.find({ order: { order: 'ASC' } });
    await this.archiveConfirmed(rows);
    const scoped = projectId === undefined
      ? rows
      : projectId === null
        ? rows.filter((t) => t.projectId == null)
        : rows.filter((t) => Number(t.projectId) === projectId);
    return scoped.map((t) => this.hydrate(t));
  }

  // { sections, tasks } for one project (or, projectId === null, the
  // General Tasks board) — the board payload.
  async board(projectId: number | null) {
    const sections = await this.sections.forProject(projectId);
    const tasks = await this.findAll(projectId);
    return { sections, tasks };
  }

  /** One task, for access checks. */
  async get(id: string) {
    return this.load(id);
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
  /**
   * A column named like a bucket (To Do, Assigned, In Progress, On Hold, Done /
   * Complete, Confirmed) and the task's status are one thing: dragging a card into
   * it sets the status, and setting the status files the card there. Columns with
   * other names ("In Review") leave the status alone.
   */
  private async syncBucketSection(task: Partial<ProjectTaskEntity>, patch: Record<string, any>) {
    const projectId = patch.projectId !== undefined ? patch.projectId : task.projectId;
    if (projectId === undefined) return;
    const sections = await this.sections.forProject(projectId == null ? null : Number(projectId));
    const bucketOf = (id?: string | null) => bucketStatus(sections.find((x) => x.id === id)?.name);
    const movingSection = 'sectionId' in patch && patch.sectionId !== task.sectionId;
    const changingStatus = 'status' in patch && patch.status !== task.status;
    if (movingSection && !changingStatus) {
      const into = bucketOf(patch.sectionId);
      if (into) patch.status = into;
      // Out of the hold column into one that isn't a bucket: no longer on hold.
      else if (task.status === 'On hold' && bucketOf(task.sectionId) === 'On hold') patch.status = 'In progress';
    } else if (changingStatus && !movingSection) {
      if (bucketOf(task.sectionId) === patch.status) return;
      // Complete may live in a "Done" column and Confirmed alongside it when there's no Confirmed column.
      const target = sections.find((x) => bucketStatus(x.name) === patch.status)
        || (patch.status === 'Confirmed' ? sections.find((x) => bucketStatus(x.name) === 'Done') : undefined)
        || (patch.status === 'Assigned' ? sections.find((x) => bucketStatus(x.name) === 'Not started') : undefined);
      if (target && target.id !== task.sectionId) patch.sectionId = target.id;
      else if (!target && bucketOf(task.sectionId) && bucketOf(task.sectionId) !== patch.status) {
        // Leaving a bucket column for a status with no column of its own: In Progress is the usual home.
        const fallback = sections.find((x) => bucketStatus(x.name) === 'In progress');
        if (fallback && patch.status !== 'Assigned' && patch.status !== 'Not started') patch.sectionId = fallback.id;
      }
    }
  }

  /**
   * Keep `status` and the older `completed` flag together, and apply the bucket
   * rules: To Do becomes Assigned once someone is assigned (and back if they're
   * removed); a task's start date is set the first time it goes In Progress;
   * Confirmed is the originator's call, and stamps the 7-day archive clock.
   */
  private async syncStatus(task: ProjectTaskEntity, patch: Record<string, any>, actor: UploadActor) {
    if ('status' in patch) {
      patch.completed = isDoneStatus(patch.status);
    } else if ('completed' in patch) {
      if (patch.completed) { if (!isDoneStatus(task.status)) patch.status = 'Done'; }
      else if (isDoneStatus(task.status) || !task.status) patch.status = 'In progress';
    }
    const assigned = 'assigneeId' in patch || 'assignee' in patch
      ? !!(patch.assigneeId || (patch.assignee || '').trim())
      : !!(task.assigneeId || (task.assignee || '').trim());
    const status = patch.status ?? task.status ?? 'Not started';
    if (status === 'Not started' && assigned) patch.status = 'Assigned';
    if (status === 'Assigned' && !assigned) patch.status = 'Not started';

    const next = patch.status ?? task.status;
    if (next === 'In progress' && task.status !== 'In progress' && !task.startDate && !patch.startDate) {
      patch.startDate = new Date().toISOString().slice(0, 10);
    }
    if (next === 'Confirmed' && task.status !== 'Confirmed') {
      const originator = task.createdById || this.createdByIdOf(task);
      if (originator && actor.id !== originator && !(await this.isAdmin(actor))) {
        throw new BadRequestException(`Only ${task.createdByName || 'whoever created it'} (or an admin) can confirm this task.`);
      }
      patch.confirmedAt = new Date().toISOString();
      patch.completed = true;
    } else if (next !== 'Confirmed' && (task.confirmedAt || task.archivedAt)) {
      patch.confirmedAt = null;
      patch.archivedAt = null;
    }
  }

  private createdByIdOf(task: ProjectTaskEntity): string | undefined {
    const ev = normalizeList<ActivityEvent>(task.activity).find((e) => e.type === 'created');
    return (ev as any)?.actorId || (ev as any)?.byId || undefined;
  }

  private async isAdmin(actor: UploadActor) {
    if (!actor.id) return false;
    const u = await this.users.findOneBy({ id: actor.id });
    return u?.roleKey === 'admin';
  }

  /** A subtask must say who does it and by when -- that's what makes it trackable. */
  private assertSubtaskFields(t: { assignee?: string | null; assigneeId?: string | null; dueDate?: string | null }) {
    const missing = [!(t.assigneeId || (t.assignee || '').trim()) && 'an assignee', !(t.dueDate || '').trim() && 'a due date'].filter(Boolean);
    if (missing.length) throw new BadRequestException(`A subtask needs ${missing.join(' and ')}.`);
  }

  /** A parent can't be finished while any of its subtasks is still open. */
  private async assertSubtasksDone(parentId: string) {
    const open = (await this.repo.find({ where: { parentId } })).filter((s) => !s.completed && !isDoneStatus(s.status));
    if (open.length) throw new BadRequestException(`Finish its ${open.length} open subtask${open.length === 1 ? '' : 's'} first.`);
  }

  async create(dto: any, actor: UploadActor = { name: 'Unknown' }) {
    if (dto.parentId) this.assertSubtaskFields(dto);
    const id = dto.id || 'T-' + String(Date.now());
    if (dto.status) {
      dto = { ...dto, status: normalizeTaskStatus(dto.status) };
      const p: Record<string, any> = { status: dto.status };
      await this.syncBucketSection({ projectId: dto.projectId == null ? null : Number(dto.projectId), sectionId: dto.sectionId, status: '' }, p);
      if (p.sectionId) dto.sectionId = p.sectionId;
    } else if (dto.sectionId) {
      // Added straight into a bucket column (e.g. "+ Add task" under In Progress): that's its status.
      const sections = await this.sections.forProject(dto.projectId == null ? null : Number(dto.projectId));
      const b = bucketStatus(sections.find((x) => x.id === dto.sectionId)?.name);
      if (b) dto = { ...dto, status: b };
    }
    const assignee = await resolveAssignee(this.users, { id: dto.assigneeId, name: dto.assignee });
    // Checklist templates marked "add automatically to" tasks (not subtasks).
    const templates = !dto.parentId && this.checklistTemplates ? await this.checklistTemplates.find().catch(() => []) : [];
    const checklist = withAutoChecklists(templates, { kind: 'task', labels: normalizeList<string>(dto.labels) }, normalizeList(dto.checklist));
    let status: string = dto.status || (dto.completed ? 'Done' : 'Not started');
    if (status === 'Not started' && assignee.name) status = 'Assigned';
    const task = {
      order: 0, parentId: null, attachments: [], comments: [],
      createdAt: new Date().toISOString().slice(0, 10),
      ...dto,
      assignee: assignee.name,
      assigneeId: assignee.id ?? undefined,
      status,
      completed: isDoneStatus(status) || !!dto.completed,
      startDate: dto.startDate || (status === 'In progress' ? new Date().toISOString().slice(0, 10) : undefined),
      createdById: actor.id, createdByName: actor.name,
      checklist,
      labels: normalizeList<string>(dto.labels),
      collaborators: normalizeCollaborators(dto.collaborators, assignee.id),
      activity: [event('created', actor, { text: 'created this task' })],
      updatedAt: new Date().toISOString(),
      projectId: dto.projectId == null ? null : Number(dto.projectId),
      id,
    };
    const peers = (await this.repo.find()).filter((t) => (t.projectId ?? null) === (task.projectId ?? null));
    task.serial = nextSerial(peers.map((t) => t.serial), 'task', serialYear());
    const saved = await this.repo.save(this.repo.create(task as Partial<ProjectTaskEntity>));
    if (assignee.id) {
      this.notifications.taskAssigned({
        surface: 'board', taskId: saved.id, title: saved.title, description: saved.description,
        projectId: saved.projectId, dueDate: saved.dueDate, priority: saved.priority,
        status: saved.status, assigneeId: assignee.id, actor,
      });
    }
    const followers = normalizeCollaborators(saved.collaborators);
    if (followers.length) this.notifications.taskFollowUp(this.notice(saved, actor), followers.map((c) => c.id), { kind: 'added' });
    return this.hydrate(saved);
  }

  /** The task card an email carries. */
  private notice(t: ProjectTaskEntity, actor: UploadActor) {
    return { surface: 'board' as const, taskId: t.id, title: t.title, description: t.description, projectId: t.projectId, dueDate: t.dueDate, priority: t.priority, status: t.status, actor };
  }

  async update(id: string, dto: any, actor: UploadActor = { name: 'Unknown' }) {
    let task = await this.repo.findOneBy({ id });
    if (!task) task = this.repo.create({ id, createdAt: new Date().toISOString().slice(0, 10) } as Partial<ProjectTaskEntity>);

    const patch: Record<string, any> = { ...dto };
    delete patch.id; delete patch.serial;

    if ('assignee' in patch || 'assigneeId' in patch) {
      const assignee = await resolveAssignee(this.users, { id: patch.assigneeId, name: patch.assignee });
      patch.assignee = assignee.name;
      patch.assigneeId = assignee.id ?? null;
    }
    if ('status' in patch) patch.status = normalizeTaskStatus(patch.status);
    await this.syncBucketSection(task, patch);
    await this.syncStatus(task, patch, actor);
    // The rules above may have changed the status (e.g. To Do -> Assigned): file the card to match.
    await this.syncBucketSection(task, patch);
    // Older subtasks may lack these; only stop someone clearing one that is set.
    if (task.parentId) {
      if ('dueDate' in patch && task.dueDate && !(patch.dueDate || '').trim()) throw new BadRequestException('A subtask needs a due date.');
      if (('assignee' in patch || 'assigneeId' in patch) && (task.assigneeId || task.assignee) && !(patch.assigneeId || (patch.assignee || '').trim())) throw new BadRequestException('A subtask needs an assignee.');
    }
    if (isDoneStatus(patch.status) && !isDoneStatus(task.status) && !task.parentId) await this.assertSubtasksDone(id);

    // Collaborators: a clean list, recorded in the activity, and newcomers told.
    let joined: { id: string; name: string }[] = [];
    const collabEvents: ActivityEvent[] = [];
    if ('collaborators' in patch) {
      patch.collaborators = normalizeCollaborators(patch.collaborators, patch.assigneeId ?? task.assigneeId);
      const { added, removed } = collaboratorChanges(task.collaborators, patch.collaborators);
      joined = added;
      if (added.length) collabEvents.push(event('collaborators', actor, { text: `added ${added.map((c) => c.name).join(', ')} as collaborator${added.length === 1 ? '' : 's'}` }));
      if (removed.length) collabEvents.push(event('collaborators', actor, { text: `removed ${removed.map((c) => c.name).join(', ')} from collaborators` }));
    }
    const finished = isDoneStatus(patch.status) && !isDoneStatus(task.status);

    const events = [...diffEvents(task, patch, actor), ...collabEvents];
    const reassignedTo = 'assigneeId' in patch && patch.assigneeId && patch.assigneeId !== task.assigneeId
      ? String(patch.assigneeId)
      : null;

    Object.assign(task, patch, { id });
    task.activity = [...normalizeList<ActivityEvent>(task.activity), ...events];
    task.updatedAt = new Date().toISOString();
    const saved = await this.repo.save(task);

    if (reassignedTo) {
      this.notifications.taskAssigned({
        surface: 'board', taskId: saved.id, title: saved.title, description: saved.description,
        projectId: saved.projectId, dueDate: saved.dueDate, priority: saved.priority,
        status: saved.status, assigneeId: reassignedTo, actor,
      });
    }
    if (joined.length) this.notifications.taskFollowUp(this.notice(saved, actor), joined.map((c) => c.id), { kind: 'added' });
    if (finished) this.notifications.taskFollowUp(this.notice(saved, actor), normalizeCollaborators(saved.collaborators).map((c) => c.id), { kind: 'done' });
    return this.hydrate(saved);
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
    return task.projectId == null ? 'General Tasks' : `Project ${task.projectId}`;
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
    const saved = await this.repo.save(task);
    // Everyone following the task hears about a comment (the assignee too), except its author.
    const followers = [...normalizeCollaborators(saved.collaborators).map((c) => c.id), saved.assigneeId].filter(Boolean) as string[];
    if (followers.length) this.notifications.taskFollowUp(this.notice(saved, actor), followers, { kind: 'comment', comment: comment.text });
    return this.hydrate(saved);
  }
}
