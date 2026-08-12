import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity } from '../database/entities';
import { ALL_TASKS } from '../seed-data/tasks';

function flatSeed() {
  const rows: any[] = [];
  (['internal', 'owner', 'subcontractor'] as const).forEach((tab) => {
    ALL_TASKS[tab].forEach((t) => rows.push({ ...t, tab }));
  });
  return rows;
}

@Injectable()
export class TasksService {
  private mem: any[] = flatSeed();

  constructor(
    @Optional() @InjectRepository(TaskEntity) private readonly repo?: Repository<TaskEntity>,
  ) {}

  findAll(tab?: string, project?: string) {
    if (this.repo) {
      const where: Record<string, string> = {};
      if (tab) where.tab = tab;
      if (project) where.project = project;
      return this.repo.find({ where });
    }
    let rows = this.mem;
    if (tab) rows = rows.filter((t) => t.tab === tab);
    if (project) rows = rows.filter((t) => t.project === project);
    return rows;
  }

  async findOne(id: string) {
    const task = this.repo ? await this.repo.findOneBy({ id }) : this.mem.find((t) => t.id === id);
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  create(dto: any) {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const id = dto.id || `${dateStr}-${String(now.getTime()).slice(-2)}`;
    const task = { tab: 'internal', daysOpen: 0, ...dto, id };
    if (this.repo) return this.repo.save(this.repo.create(task as Partial<TaskEntity>));
    this.mem = [task, ...this.mem];
    return task;
  }
}
