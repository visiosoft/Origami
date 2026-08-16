import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity } from '../database/entities';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity) private readonly repo: Repository<TaskEntity>,
  ) {}

  findAll(tab?: string, project?: string) {
    const where: Record<string, string> = {};
    if (tab) where.tab = tab;
    if (project) where.project = project;
    return this.repo.find({ where });
  }

  async findOne(id: string) {
    const task = await this.repo.findOneBy({ id });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async create(dto: any) {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    // Task # is always YYYYMMDD-NN with NN a sequence for that day (01, 02, …).
    const rows = await this.repo.find();
    const seq = rows
      .filter((t) => String(t.id).startsWith(dateStr + '-'))
      .reduce((max, t) => Math.max(max, parseInt(String(t.id).split('-')[1], 10) || 0), 0) + 1;
    const id = dto.id || `${dateStr}-${String(seq).padStart(2, '0')}`;
    // Fill NOT NULL columns so a partial form doesn't violate the schema.
    const task = {
      tab: 'internal', meetingType: 'Internal', meetingDate: now.toISOString().slice(0, 10),
      status: 'Open', topicType: 'Task', description: '', project: '', daysOpen: 0,
      ...dto, id,
    };
    return this.repo.save(this.repo.create(task as Partial<TaskEntity>));
  }
}
