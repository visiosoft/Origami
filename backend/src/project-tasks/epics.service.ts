import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { ProjectEpicEntity, ProjectTaskEntity } from '../database/entities';
import { isDoneStatus } from '../database/task.types';

export interface EpicInput { projectId?: number | null; name?: string; color?: string; dueDate?: string | null; order?: number }

/** Progress of one epic from its top-level tasks (subtasks ride with their parent). */
export function epicProgress(epicId: string, tasks: { epicId?: string | null; parentId?: string | null; status?: string | null; completed?: boolean; archivedAt?: string | null }[]) {
  const mine = tasks.filter((t) => t.epicId === epicId && !t.parentId);
  const done = mine.filter((t) => t.completed || isDoneStatus(t.status) || !!t.archivedAt).length;
  return { total: mine.length, done };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR = /^#[0-9a-f]{3,8}$/i;

/** Nov 17 sync: epics -- named groups that tie related tasks together on a board. */
@Injectable()
export class EpicsService {
  constructor(
    @InjectRepository(ProjectEpicEntity) private readonly repo: Repository<ProjectEpicEntity>,
    @InjectRepository(ProjectTaskEntity) private readonly tasks: Repository<ProjectTaskEntity>,
  ) {}

  /** A board's epics, with progress. projectId null = General Tasks. */
  async list(projectId: number | null) {
    const where = { projectId: projectId == null ? IsNull() : projectId, archivedAt: IsNull() } as any;
    const [epics, tasks] = await Promise.all([
      this.repo.find({ where, order: { order: 'ASC', createdAt: 'ASC' } }),
      this.tasks.find({ where: { projectId: projectId == null ? IsNull() : projectId } as any, select: { id: true, epicId: true, parentId: true, status: true, completed: true, archivedAt: true } as any }),
    ]);
    return epics.map((e) => ({ ...e, ...epicProgress(e.id, tasks) }));
  }

  async create(input: EpicInput) {
    const name = String(input.name || '').trim().slice(0, 120);
    if (!name) throw new BadRequestException('Give the epic a name.');
    const projectId = input.projectId == null || (input.projectId as any) === '' ? null : Number(input.projectId);
    const count = await this.repo.count({ where: { projectId: projectId == null ? IsNull() : projectId } as any });
    const e = this.repo.create({
      id: 'EP-' + randomBytes(5).toString('hex'), projectId, name,
      color: COLOR.test(input.color || '') ? input.color! : '#5B7C99',
      dueDate: DATE.test(input.dueDate || '') ? input.dueDate! : null,
      order: count, createdAt: new Date().toISOString(), archivedAt: null,
    });
    return this.repo.save(e);
  }

  async get(id: string) {
    const e = await this.repo.findOneBy({ id });
    if (!e) throw new NotFoundException('That epic no longer exists.');
    return e;
  }

  async update(id: string, input: EpicInput) {
    const e = await this.get(id);
    if (input.name !== undefined) { const n = String(input.name).trim().slice(0, 120); if (!n) throw new BadRequestException('Give the epic a name.'); e.name = n; }
    if (input.color !== undefined && COLOR.test(input.color)) e.color = input.color;
    if (input.dueDate !== undefined) e.dueDate = DATE.test(input.dueDate || '') ? input.dueDate! : null;
    if (input.order !== undefined && Number.isFinite(Number(input.order))) e.order = Number(input.order);
    return this.repo.save(e);
  }

  /** Remove: the epic is archived and its tasks simply have no epic any more (nothing else changes). */
  async remove(id: string) {
    const e = await this.get(id);
    e.archivedAt = new Date().toISOString();
    await this.repo.save(e);
    await this.tasks.update({ epicId: id } as any, { epicId: null } as any);
    return { ok: true };
  }
}
