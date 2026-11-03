import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity, ProjectTaskEntity, TagEntity, TaskEntity, UserEntity } from '../database/entities';
import { ACTION_TAGS } from '../database/task.types';
import { autoTags, cleanTagName, isStandard, splitTags, STANDARD_LABELS, tagKey, tagsAfterLabelEdit } from './tag-rules';

export interface TagInfo { key: string; name: string; standard: boolean; uses: number }

/** The shared tag bank (Oct 30 sync): standard tags, plus every custom tag anyone has used. */
@Injectable()
export class TagsService implements OnApplicationBootstrap {
  private readonly log = new Logger('Tags');
  private names: { at: number; list: string[] } | null = null;

  constructor(
    @InjectRepository(TagEntity) private readonly bank: Repository<TagEntity>,
    @InjectRepository(TaskEntity) private readonly logTasks: Repository<TaskEntity>,
    @InjectRepository(ProjectTaskEntity) private readonly boardTasks: Repository<ProjectTaskEntity>,
    @Optional() @InjectRepository(UserEntity) private readonly users?: Repository<UserEntity>,
    @Optional() @InjectRepository(ProjectEntity) private readonly projects?: Repository<ProjectEntity>,
  ) {}

  /**
   * A new special action's tags (Oct 30 sync; rules in tag-rules.ts autoTags).
   * Standard tags typed among the custom ones move across. New custom tags join the bank.
   */
  async newItemTags(i: { tags?: unknown; labels?: unknown; actor: { id?: string; name?: string }; assigneeId?: string | null; leadId?: string | null; projectId?: number | null; projectName?: string | null; financial?: boolean }) {
    const split = splitTags(i.labels);
    const userTier = async (id?: string | null) => (id && this.users ? (await this.users.findOneBy({ id }))?.tier : undefined);
    const [actorTier, assigneeTier] = await Promise.all([userTier(i.actor.id), userTier(i.assigneeId)]);
    const project = !i.leadId && this.projects && (i.projectId != null || i.projectName)
      ? i.projectId != null ? await this.projects.findOneBy({ id: Number(i.projectId) }) : await this.projects.findOneBy({ name: String(i.projectName) })
      : null;
    const tags = autoTags({
      tags: Array.isArray(i.tags) ? [...i.tags, ...split.standard] : split.standard.length ? split.standard : undefined,
      labels: split.custom,
      outsideCreator: !!actorTier && actorTier !== 'internal',
      outsideAssignee: assigneeTier === 'client' ? 'client' : assigneeTier && assigneeTier !== 'internal' ? 'external' : null,
      fromLead: !!i.leadId,
      projectStage: project?.stage || null,
      financial: !!i.financial,
      people: await this.peopleNames(),
    });
    void this.remember(split.custom, i.actor).catch(() => undefined);
    return { tags, labels: split.custom };
  }

  /** An edit: standard tags typed as custom ones move across; a personal tag just added brings Internal; new ones join the bank. */
  async editedTags(i: { tags: unknown; labelsBefore: unknown; labels: unknown; actor: { name?: string } }) {
    const split = splitTags(i.labels);
    const before = splitTags(i.labelsBefore).custom;
    const tags = tagsAfterLabelEdit([...(Array.isArray(i.tags) ? i.tags : []), ...split.standard], before, split.custom, await this.peopleNames());
    void this.remember(split.custom, i.actor).catch(() => undefined);
    return { tags, labels: split.custom };
  }

  /** Custom tags already on tasks join the bank (adds rows only; no task is changed). */
  async onApplicationBootstrap() {
    setTimeout(() => { void this.seed().catch((e) => this.log.warn('Seeding the tag bank: ' + (e as Error).message)); }, 20_000).unref?.();
  }
  async seed() {
    const labels = (await this.allLabels()).flatMap((r) => r.labels);
    return this.remember(labels, { name: 'From existing tasks' });
  }

  private async allLabels() {
    const [a, b] = await Promise.all([
      this.logTasks.find({ select: { id: true, labels: true } as any }),
      this.boardTasks.find({ select: { id: true, labels: true } as any }),
    ]);
    const norm = (rows: { id: string; labels?: string[] | null }[], kind: 'log' | 'board') => rows.map((r) => ({ kind, id: r.id, labels: Array.isArray(r.labels) ? r.labels.map(String) : [] }));
    return [...norm(a as any, 'log'), ...norm(b as any, 'board')];
  }

  /** Every tag: the standard seven first, then custom ones A-Z, with how many tasks use each. */
  async list(): Promise<TagInfo[]> {
    const [rows, tasks] = await Promise.all([this.bank.find(), this.allLabels()]);
    const uses = new Map<string, number>();
    for (const t of tasks) for (const l of new Set(t.labels.map((x) => x.toLowerCase()))) uses.set(l, (uses.get(l) || 0) + 1);
    return [
      ...ACTION_TAGS.map((k) => ({ key: k, name: STANDARD_LABELS[k], standard: true, uses: 0 })),
      ...rows.sort((x, y) => x.name.localeCompare(y.name)).map((r) => ({ key: r.key, name: r.name, standard: false, uses: uses.get(r.key) || 0 })),
    ];
  }

  /** Custom tags just used: any new one joins the bank. Returns how many were added. */
  async remember(names: unknown, actor: { name?: string }) {
    const list = (Array.isArray(names) ? names : []).map(cleanTagName).filter((n) => n && !isStandard(n));
    if (!list.length) return 0;
    const have = new Set((await this.bank.find({ select: { key: true } as any })).map((r) => r.key));
    let added = 0;
    for (const name of list) {
      const key = name.toLowerCase();
      if (have.has(key)) continue;
      have.add(key);
      await this.bank.save(this.bank.create({ key, name, createdBy: actor.name || null, createdAt: new Date().toISOString() }));
      added++;
    }
    return added;
  }

  async add(name: unknown, actor: { name?: string }) {
    const n = cleanTagName(name);
    if (!n) throw new BadRequestException('Type a tag.');
    if (isStandard(n)) throw new BadRequestException(`“${n}” is one of the standard tags already.`);
    await this.remember([n], actor);
    return (await this.list()).find((t) => t.key === n.toLowerCase());
  }

  /**
   * Admins: rename a custom tag on every task (a name that's already a tag
   * merges the two). Returns how many tasks changed.
   */
  async rename(key: string, to: unknown) {
    const from = tagKey(key);
    const name = cleanTagName(to);
    if (!name) throw new BadRequestException('Type the new name.');
    if (isStandard(from)) throw new BadRequestException('Standard tags can’t be renamed.');
    if (isStandard(name)) throw new BadRequestException(`“${name}” is a standard tag — pick another name.`);
    const row = await this.bank.findOneBy({ key: from });
    if (!row) throw new NotFoundException('That tag isn’t in the list.');
    const changed = await this.rewrite(from, name);
    if (name.toLowerCase() !== from) await this.bank.delete({ key: from });
    const existing = await this.bank.findOneBy({ key: name.toLowerCase() });
    await this.bank.save({ ...(existing || row), key: name.toLowerCase(), name });
    return { changed, tag: (await this.list()).find((t) => t.key === name.toLowerCase()) };
  }

  /** Admins: take a custom tag off every task and out of the list. */
  async remove(key: string) {
    const from = tagKey(key);
    if (isStandard(from)) throw new BadRequestException('Standard tags can’t be deleted.');
    const changed = await this.rewrite(from, null);
    await this.bank.delete({ key: from });
    return { changed };
  }

  /** Replace (or drop) a custom tag in every task's labels; only tasks carrying it are written. */
  private async rewrite(from: string, to: string | null) {
    let changed = 0;
    for (const t of await this.allLabels()) {
      if (!t.labels.some((l) => l.toLowerCase() === from)) continue;
      const next: string[] = [];
      for (const l of t.labels) {
        const v = l.toLowerCase() === from ? to : l;
        if (v && !next.some((x) => x.toLowerCase() === v.toLowerCase())) next.push(v);
      }
      await (t.kind === 'log' ? this.logTasks : this.boardTasks).update({ id: t.id } as any, { labels: next } as any);
      changed++;
    }
    return changed;
  }

  /** Everyone's names, for personal tags ("Astrid private"); cached a minute. */
  async peopleNames(): Promise<string[]> {
    if (this.names && Date.now() - this.names.at < 60_000) return this.names.list;
    const list = this.users ? (await this.users.find({ select: { name: true } as any })).map((u) => u.name).filter(Boolean) : [];
    this.names = { at: Date.now(), list };
    return list;
  }
}
