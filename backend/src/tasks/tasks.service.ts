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

  create(dto: any) {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const id = dto.id || `${dateStr}-${String(now.getTime()).slice(-2)}`;
    const task = { tab: 'internal', daysOpen: 0, ...dto, id };
    return this.repo.save(this.repo.create(task as Partial<TaskEntity>));
  }
}
