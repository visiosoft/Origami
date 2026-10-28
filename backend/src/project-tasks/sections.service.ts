import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ProjectSectionEntity } from '../database/entities';
import { randomUUID } from 'crypto';
import { DEFAULT_SECTIONS, defaultSectionsFor, ProjectSection } from '../seed-data/project-tasks';
import { alignPlan, byBoard, orderedBy, sameName, type Column } from './board-columns';

@Injectable()
export class SectionsService implements OnApplicationBootstrap {
  private readonly log = new Logger('SectionsService');

  constructor(
    @InjectRepository(ProjectSectionEntity) private readonly repo: Repository<ProjectSectionEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_SECTIONS as unknown as ProjectSectionEntity[]);
        this.log.log(`Seeded ${DEFAULT_SECTIONS.length} project sections`);
      }
    } catch (err) {
      this.log.error('Section seed failed: ' + (err as Error).message);
    }
  }

  async getById(id: string): Promise<ProjectSection | undefined> {
    return (await this.repo.findOneBy({ id })) ?? undefined;
  }

  // Returns a project's sections, creating the default set the first time.
  // `null` = the General Tasks board's sections (not tied to any project).
  async forProject(projectId: number | null): Promise<ProjectSection[]> {
    if (projectId !== null && !Number.isFinite(projectId)) return []; // guard NaN/invalid ids
    let rows = await this.repo.find({ where: { projectId: projectId ?? IsNull() }, order: { order: 'ASC' } });
    if (!rows.length) {
      // A new board starts with the same headings as General (Oct 27 sync), or the defaults.
      const general = projectId === null ? [] : await this.repo.find({ where: { projectId: IsNull() }, order: { order: 'ASC' } });
      const fresh = general.length
        ? general.map((g, order) => ({ id: newId(), projectId, name: g.name, order }))
        : defaultSectionsFor(projectId);
      rows = await this.repo.save(fresh as unknown as ProjectSectionEntity[]);
    }
    return rows;
  }

  // ------------------------------------------------- the same columns on every board

  private async boards() {
    const map = byBoard((await this.repo.find()) as unknown as Column[]);
    if (!map.has(null)) map.set(null, []);
    return map;
  }

  /** A new column at the end of every board. */
  async addEverywhere(name: string) {
    const label = String(name || '').trim() || 'New Section';
    const rows: Partial<ProjectSectionEntity>[] = [];
    for (const [projectId, cols] of await this.boards()) {
      if (cols.some((c) => sameName(c.name, label))) continue;
      rows.push({ id: newId(), projectId, name: label, order: cols.length });
    }
    await this.repo.save(rows as ProjectSectionEntity[]);
    return { added: rows.length, name: label };
  }

  /** Rename a column on every board that has one by its current name. */
  async renameEverywhere(id: string, name: string) {
    const section = await this.repo.findOneBy({ id });
    const label = String(name || '').trim();
    if (!section || !label) return { renamed: 0 };
    const same = (await this.repo.find()).filter((c) => sameName(c.name, section.name));
    for (const c of same) c.name = label;
    await this.repo.save(same);
    return { renamed: same.length };
  }

  /** Put every board's columns in this order (by name). */
  async reorderEverywhere(names: string[]) {
    const updates: { id: string; order: number }[] = [];
    for (const cols of (await this.boards()).values()) updates.push(...orderedBy(names, cols));
    for (const u of updates) await this.repo.update({ id: u.id }, { order: u.order });
    return { boards: (await this.boards()).size };
  }

  /**
   * Delete a column from every board that has it; each board's tasks in it go
   * to that board's first remaining column. A board left with nothing keeps it.
   */
  async removeEverywhere(id: string, moveTasks: (from: string, to: string) => Promise<unknown>) {
    const section = await this.repo.findOneBy({ id });
    if (!section) return { removed: 0 };
    let removed = 0;
    for (const cols of (await this.boards()).values()) {
      const hit = cols.find((c) => sameName(c.name, section.name));
      const rest = cols.filter((c) => c !== hit);
      if (!hit || !rest.length) continue;
      await moveTasks(hit.id, rest[0].id);
      await this.repo.delete({ id: hit.id });
      removed++;
    }
    return { removed };
  }

  /**
   * Make every board carry exactly this board's columns, in its order. Columns
   * a board has that this one doesn't are removed, their tasks moved to that
   * board's first column -- nothing is deleted but the empty headings.
   */
  async matchAll(projectId: number | null, moveTasks: (from: string, to: string) => Promise<unknown>) {
    const boards = await this.boards();
    const names = (boards.get(projectId) || []).map((c) => c.name);
    if (!names.length) return { boards: 0 };
    let changed = 0;
    for (const [pid, cols] of boards) {
      if (pid === projectId) continue;
      const plan = alignPlan(names, cols);
      if (!plan.create.length && !plan.remove.length && plan.keep.every((k) => cols.some((c) => c.id === k.id && c.name === k.name && c.order === k.order))) continue;
      for (const k of plan.keep) await this.repo.update({ id: k.id }, { name: k.name, order: k.order });
      const made = plan.create.length ? await this.repo.save(plan.create.map((c) => ({ id: newId(), projectId: pid, name: c.name, order: c.order })) as ProjectSectionEntity[]) : [];
      const first = [...plan.keep, ...made].sort((a, b) => a.order - b.order)[0];
      for (const gone of plan.remove) { if (first) await moveTasks(gone, first.id); await this.repo.delete({ id: gone }); }
      changed++;
    }
    return { boards: changed };
  }

  create(dto: any) {
    const projectId = dto.projectId == null ? null : Number(dto.projectId);
    const section = { name: 'New Section', order: 0, ...dto, projectId, id: dto.id || 'S-' + Date.now() };
    return this.repo.save(this.repo.create(section as Partial<ProjectSectionEntity>));
  }

  async update(id: string, dto: any) {
    let section = await this.repo.findOneBy({ id });
    if (!section) section = this.repo.create({ id } as Partial<ProjectSectionEntity>);
    Object.assign(section, dto, { id });
    return this.repo.save(section);
  }

  async remove(id: string) {
    const section = await this.repo.findOneBy({ id });
    if (section) await this.repo.remove(section);
    return { id, deleted: true };
  }
}

const newId = () => 'S-' + randomUUID().slice(0, 13);
