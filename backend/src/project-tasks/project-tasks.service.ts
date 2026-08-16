import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectTaskEntity } from '../database/entities';
import { DEFAULT_TASKS } from '../seed-data/project-tasks';
import { SectionsService } from './sections.service';

@Injectable()
export class ProjectTasksService implements OnApplicationBootstrap {
  private readonly log = new Logger('ProjectTasksService');

  constructor(
    @InjectRepository(ProjectTaskEntity) private readonly repo: Repository<ProjectTaskEntity>,
    private readonly sections: SectionsService,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_TASKS as unknown as ProjectTaskEntity[]);
        this.log.log(`Seeded ${DEFAULT_TASKS.length} project tasks`);
      }
    } catch (err) {
      this.log.error('Task seed failed: ' + (err as Error).message);
    }
  }

  async findAll(projectId?: number): Promise<any[]> {
    const rows = await this.repo.find({ order: { order: 'ASC' } });
    return projectId ? rows.filter((t) => Number(t.projectId) === projectId) : rows;
  }

  // { sections, tasks } for one project — the board payload.
  async board(projectId: number) {
    const sections = await this.sections.forProject(projectId);
    const tasks = await this.findAll(projectId);
    return { sections, tasks };
  }

  create(dto: any) {
    const id = dto.id || 'T-' + String(Date.now());
    const task = {
      order: 0, completed: false, parentId: null, attachments: [], comments: [],
      createdAt: new Date().toISOString().slice(0, 10),
      ...dto,
      projectId: Number(dto.projectId),
      id,
    };
    return this.repo.save(this.repo.create(task as Partial<ProjectTaskEntity>));
  }

  async update(id: string, dto: any) {
    let task = await this.repo.findOneBy({ id });
    if (!task) task = this.repo.create({ id, createdAt: new Date().toISOString().slice(0, 10) } as Partial<ProjectTaskEntity>);
    Object.assign(task, dto, { id });
    return this.repo.save(task);
  }

  // Move all tasks from one section to another (used when a section is deleted).
  async reparentTasks(fromSectionId: string, toSectionId: string) {
    await this.repo.update({ sectionId: fromSectionId }, { sectionId: toSectionId });
  }

  async deleteTasksInSection(sectionId: string) {
    await this.repo.delete({ sectionId });
  }

  async remove(id: string) {
    // Also remove subtasks of this task.
    const task = await this.repo.findOneBy({ id });
    if (task) await this.repo.remove(task);
    const subs = await this.repo.find({ where: { parentId: id } });
    if (subs.length) await this.repo.remove(subs);
    return { id, deleted: true };
  }
}
