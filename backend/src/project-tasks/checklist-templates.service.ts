import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistTemplateEntity, ProjectTaskEntity } from '../database/entities';
import { cleanAutoFor, withAutoChecklists } from './auto-checklist';

export interface TemplateActor { id?: string; name: string; roleKey?: string }
const MAX_ITEMS = 100;

/**
 * Checklist templates: a named list of items ("Pre-pour inspection") made once
 * and added to any task. Anyone can make one; only whoever made it, or an
 * admin, can change or delete it.
 */
@Injectable()
export class ChecklistTemplatesService {
  constructor(
    @InjectRepository(ChecklistTemplateEntity) private readonly repo: Repository<ChecklistTemplateEntity>,
    @Optional() @InjectRepository(ProjectTaskEntity) private readonly tasks?: Repository<ProjectTaskEntity>,
  ) {}

  async kindOf(id: string) { return (await this.repo.findOneBy({ id }))?.kind || 'general'; }

  /**
   * A QA/QC checklist tied to a programme task or a label (Nov 13) also goes
   * onto the open tasks that already exist, not only ones set up from now on.
   */
  async applyToExisting(t: ChecklistTemplateEntity) {
    if (t.kind !== 'qaqc' || !this.tasks || !(t.autoFor || []).some((a) => /^(programme|label):/.test(a))) return 0;
    const changed: ProjectTaskEntity[] = [];
    for (const task of await this.tasks.find()) {
      if (task.completed) continue;
      const m = /^T-\d+-(.+)$/.exec(task.id);
      const before = Array.isArray(task.checklist) ? task.checklist : [];
      // Only from a programme task or label match -- never "every task" here.
      const tpl = { ...t, autoFor: (t.autoFor || []).filter((a) => /^(programme|label):/.test(a)) };
      const next = withAutoChecklists([tpl], { kind: 'task', labels: task.labels || [], programmeId: m?.[1] }, before);
      if (next.length !== before.length) { task.checklist = next; changed.push(task); }
    }
    for (let i = 0; i < changed.length; i += 100) await this.tasks.save(changed.slice(i, i + 100));
    return changed.length;
  }

  /** QA/QC checklists on tasks (for the QA/QC page): per task and template, items done of total. */
  async qaqc(ok: (projectId: number) => boolean) {
    if (!this.tasks) return [];
    const tpls = new Map((await this.repo.find()).filter((t) => t.kind === 'qaqc').map((t) => [t.id, t.name]));
    if (!tpls.size) return [];
    const out: { taskId: string; projectId: number; title: string; phaseId: string | null; templateId: string; templateName: string; total: number; done: number; dueDate: string | null; assignee: string | null; completed: boolean }[] = [];
    for (const task of await this.tasks.find()) {
      if (!ok(Number(task.projectId))) continue;
      const by = new Map<string, { total: number; done: number }>();
      for (const c of Array.isArray(task.checklist) ? task.checklist : []) {
        if (!c.templateId || !tpls.has(c.templateId)) continue;
        const g = by.get(c.templateId) || { total: 0, done: 0 };
        g.total++; if (c.done) g.done++;
        by.set(c.templateId, g);
      }
      for (const [templateId, g] of by) out.push({ taskId: task.id, projectId: Number(task.projectId), title: task.title, phaseId: task.phaseId || null, templateId, templateName: tpls.get(templateId)!, ...g, dueDate: task.dueDate || null, assignee: task.assignee || null, completed: !!task.completed });
    }
    return out.sort((a, b) => Number(a.completed) - Number(b.completed) || String(a.dueDate || '9').localeCompare(String(b.dueDate || '9')));
  }

  async list() {
    return (await this.repo.find()).map((t) => ({ ...t, items: Array.isArray(t.items) ? t.items : [], autoFor: Array.isArray(t.autoFor) ? t.autoFor : [] })).sort((a, b) => a.name.localeCompare(b.name));
  }

  private mayEdit(t: ChecklistTemplateEntity, actor: TemplateActor) {
    return !t.createdById || t.createdById === actor.id || actor.roleKey === 'admin';
  }

  private clean(dto: { name?: string; items?: unknown; autoFor?: unknown; kind?: unknown }) {
    const name = String(dto.name || '').trim();
    if (!name) throw new BadRequestException('Name the checklist.');
    if (name.length > 120) throw new BadRequestException('Keep the name under 120 characters.');
    const items = (Array.isArray(dto.items) ? dto.items : [])
      .map((x: any) => String(typeof x === 'string' ? x : x?.item || '').trim().slice(0, 500))
      .filter(Boolean)
      .map((item) => ({ item }));
    if (!items.length) throw new BadRequestException('Add at least one item.');
    if (items.length > MAX_ITEMS) throw new BadRequestException(`Keep it to ${MAX_ITEMS} items.`);
    return { name, items, autoFor: cleanAutoFor(dto.autoFor), kind: dto.kind === 'qaqc' ? 'qaqc' : 'general' };
  }

  /** Saving under a name that's taken replaces it -- if it's yours (or you're an admin). */
  async save(dto: { name?: string; items?: unknown; autoFor?: unknown; kind?: unknown }, actor: TemplateActor) {
    const { name, items, autoFor, kind } = this.clean(dto);
    const existing = (await this.repo.find()).find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing && !this.mayEdit(existing, actor)) throw new ConflictException(`There's already a checklist called “${existing.name}” — pick another name.`);
    const now = new Date().toISOString();
    return this.repo.save(this.repo.create({
      ...(existing || { id: 'CLT-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(), createdById: actor.id, createdByName: actor.name, createdAt: now }),
      name, items, autoFor: dto.autoFor === undefined && existing ? existing.autoFor : autoFor, kind: dto.kind === undefined && existing ? existing.kind : kind, updatedAt: now,
    }));
  }

  async update(id: string, dto: { name?: string; items?: unknown; autoFor?: unknown; kind?: unknown }, actor: TemplateActor) {
    const t = await this.repo.findOneBy({ id });
    if (!t) throw new NotFoundException('Checklist template not found.');
    if (!this.mayEdit(t, actor)) throw new ForbiddenException(`Only ${t.createdByName || 'whoever made it'} or an admin can change this checklist.`);
    const { name, items, autoFor, kind } = this.clean({ name: dto.name ?? t.name, items: dto.items ?? t.items, autoFor: dto.autoFor ?? t.autoFor, kind: dto.kind ?? t.kind });
    const clash = (await this.repo.find()).find((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase());
    if (clash) throw new ConflictException(`There's already a checklist called “${clash.name}”.`);
    return this.repo.save({ ...t, name, items, autoFor, kind, updatedAt: new Date().toISOString() });
  }

  async remove(id: string, actor: TemplateActor) {
    const t = await this.repo.findOneBy({ id });
    if (!t) return { id, deleted: true };
    if (!this.mayEdit(t, actor)) throw new ForbiddenException(`Only ${t.createdByName || 'whoever made it'} or an admin can delete this checklist.`);
    await this.repo.delete({ id });
    return { id, deleted: true };
  }
}
