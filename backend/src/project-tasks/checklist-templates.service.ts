import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistTemplateEntity } from '../database/entities';

export interface TemplateActor { id?: string; name: string; roleKey?: string }
const MAX_ITEMS = 100;

/**
 * Checklist templates: a named list of items ("Pre-pour inspection") made once
 * and added to any task. Anyone can make one; only whoever made it, or an
 * admin, can change or delete it.
 */
@Injectable()
export class ChecklistTemplatesService {
  constructor(@InjectRepository(ChecklistTemplateEntity) private readonly repo: Repository<ChecklistTemplateEntity>) {}

  async list() {
    return (await this.repo.find()).map((t) => ({ ...t, items: Array.isArray(t.items) ? t.items : [] })).sort((a, b) => a.name.localeCompare(b.name));
  }

  private mayEdit(t: ChecklistTemplateEntity, actor: TemplateActor) {
    return !t.createdById || t.createdById === actor.id || actor.roleKey === 'admin';
  }

  private clean(dto: { name?: string; items?: unknown }) {
    const name = String(dto.name || '').trim();
    if (!name) throw new BadRequestException('Name the checklist.');
    if (name.length > 120) throw new BadRequestException('Keep the name under 120 characters.');
    const items = (Array.isArray(dto.items) ? dto.items : [])
      .map((x: any) => String(typeof x === 'string' ? x : x?.item || '').trim().slice(0, 500))
      .filter(Boolean)
      .map((item) => ({ item }));
    if (!items.length) throw new BadRequestException('Add at least one item.');
    if (items.length > MAX_ITEMS) throw new BadRequestException(`Keep it to ${MAX_ITEMS} items.`);
    return { name, items };
  }

  /** Saving under a name that's taken replaces it -- if it's yours (or you're an admin). */
  async save(dto: { name?: string; items?: unknown }, actor: TemplateActor) {
    const { name, items } = this.clean(dto);
    const existing = (await this.repo.find()).find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing && !this.mayEdit(existing, actor)) throw new ConflictException(`There's already a checklist called “${existing.name}” — pick another name.`);
    const now = new Date().toISOString();
    return this.repo.save(this.repo.create({
      ...(existing || { id: 'CLT-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(), createdById: actor.id, createdByName: actor.name, createdAt: now }),
      name, items, updatedAt: now,
    }));
  }

  async update(id: string, dto: { name?: string; items?: unknown }, actor: TemplateActor) {
    const t = await this.repo.findOneBy({ id });
    if (!t) throw new NotFoundException('Checklist template not found.');
    if (!this.mayEdit(t, actor)) throw new ForbiddenException(`Only ${t.createdByName || 'whoever made it'} or an admin can change this checklist.`);
    const { name, items } = this.clean({ name: dto.name ?? t.name, items: dto.items ?? t.items });
    const clash = (await this.repo.find()).find((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase());
    if (clash) throw new ConflictException(`There's already a checklist called “${clash.name}”.`);
    return this.repo.save({ ...t, name, items, updatedAt: new Date().toISOString() });
  }

  async remove(id: string, actor: TemplateActor) {
    const t = await this.repo.findOneBy({ id });
    if (!t) return { id, deleted: true };
    if (!this.mayEdit(t, actor)) throw new ForbiddenException(`Only ${t.createdByName || 'whoever made it'} or an admin can delete this checklist.`);
    await this.repo.delete({ id });
    return { id, deleted: true };
  }
}
