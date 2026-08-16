import { Injectable, OnApplicationBootstrap, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowEntity } from '../database/entities';
import { DEFAULT_WORKFLOWS } from '../seed-data/workflows';

const today = () => new Date().toISOString().slice(0, 10);

@Injectable()
export class WorkflowsService implements OnApplicationBootstrap {
  private readonly log = new Logger('WorkflowsService');

  constructor(
    @InjectRepository(WorkflowEntity) private readonly repo: Repository<WorkflowEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_WORKFLOWS as unknown as WorkflowEntity[]);
        this.log.log(`Seeded ${DEFAULT_WORKFLOWS.length} workflows`);
      }
    } catch (err) {
      this.log.error('Workflow seed failed: ' + (err as Error).message);
    }
  }

  // projectId: undefined = all; 'none' = templates (projectId null); number = that project.
  async findAll(projectId?: string) {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    if (projectId === undefined) return rows;
    if (projectId === 'none' || projectId === 'null') return rows.filter((w) => w.projectId == null);
    const pid = Number(projectId);
    return rows.filter((w) => Number(w.projectId) === pid);
  }

  findOne(id: string) {
    return this.repo.findOneBy({ id });
  }

  create(dto: any) {
    const id = dto.id || 'W-' + String(Date.now());
    const wf: any = { status: 'Draft', description: '', createdAt: today(), ...dto, id };
    if (wf.status === 'Done' && !wf.completedAt) wf.completedAt = today();
    return this.repo.save(this.repo.create(wf as Partial<WorkflowEntity>));
  }

  async update(id: string, dto: any) {
    let wf = await this.repo.findOneBy({ id });
    if (!wf) wf = this.repo.create({ id, createdAt: today() } as Partial<WorkflowEntity>);
    if (typeof dto.status === 'string') {
      if (dto.status === 'Archived' && !dto.completedAt && !wf.completedAt) dto = { ...dto, completedAt: today() };
    }
    Object.assign(wf, dto, { id });
    return this.repo.save(wf);
  }

  async remove(id: string) {
    const wf = await this.repo.findOneBy({ id });
    if (wf) await this.repo.remove(wf);
    return { id, deleted: true };
  }

  // Create a new project workflow from a template workflow (fields only; items
  // are cloned by the controller via WorkflowItemsService).
  async applyTemplate(templateId: string, projectId: number) {
    const tpl = await this.repo.findOneBy({ id: templateId });
    if (!tpl) throw new NotFoundException(`Template ${templateId} not found`);
    const id = 'W-' + String(Date.now());
    const wf = this.repo.create({
      id, projectId, name: tpl.name, description: tpl.description, status: 'Active',
      owner: tpl.owner, estimatedDays: tpl.estimatedDays, plannedStart: tpl.plannedStart,
      plannedEnd: tpl.plannedEnd, completedAt: undefined, createdAt: today(),
    } as Partial<WorkflowEntity>);
    return this.repo.save(wf);
  }
}
