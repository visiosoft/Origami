import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowItemEntity } from '../database/entities';
import { DEFAULT_WORKFLOW_ITEMS } from '../seed-data/workflows';

@Injectable()
export class WorkflowItemsService implements OnApplicationBootstrap {
  private readonly log = new Logger('WorkflowItemsService');

  constructor(
    @InjectRepository(WorkflowItemEntity) private readonly repo: Repository<WorkflowItemEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.repo.count()) === 0) {
        await this.repo.save(DEFAULT_WORKFLOW_ITEMS as unknown as WorkflowItemEntity[]);
        this.log.log(`Seeded ${DEFAULT_WORKFLOW_ITEMS.length} workflow items`);
      }
    } catch (err) {
      this.log.error('Workflow item seed failed: ' + (err as Error).message);
    }
  }

  async findAll(workflowId?: string) {
    const rows = await this.repo.find({ order: { order: 'ASC' } });
    return workflowId ? rows.filter((i) => i.workflowId === workflowId) : rows;
  }

  create(dto: any) {
    const id = dto.id || 'WI-' + String(Date.now());
    const item = { status: 'Open', order: 0, notes: '', createdAt: new Date().toISOString().slice(0, 10), ...dto, id };
    return this.repo.save(this.repo.create(item as Partial<WorkflowItemEntity>));
  }

  async update(id: string, dto: any) {
    let item = await this.repo.findOneBy({ id });
    if (!item) item = this.repo.create({ id, createdAt: new Date().toISOString().slice(0, 10) } as Partial<WorkflowItemEntity>);
    Object.assign(item, dto, { id });
    return this.repo.save(item);
  }

  async remove(id: string) {
    const item = await this.repo.findOneBy({ id });
    if (item) await this.repo.remove(item);
    return { id, deleted: true };
  }

  async deleteByWorkflow(workflowId: string) {
    await this.repo.delete({ workflowId });
  }
}
