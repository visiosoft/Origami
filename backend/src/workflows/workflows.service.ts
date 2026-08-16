import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowEntity } from '../database/entities';
import { DEFAULT_WORKFLOWS } from '../seed-data/workflows';

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

  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  create(dto: any) {
    const id = dto.id || 'W-' + String(Date.now());
    const wf = { status: 'Draft', description: '', createdAt: new Date().toISOString().slice(0, 10), ...dto, id };
    return this.repo.save(this.repo.create(wf as Partial<WorkflowEntity>));
  }

  async update(id: string, dto: any) {
    let wf = await this.repo.findOneBy({ id });
    if (!wf) wf = this.repo.create({ id, createdAt: new Date().toISOString().slice(0, 10) } as Partial<WorkflowEntity>);
    Object.assign(wf, dto, { id });
    return this.repo.save(wf);
  }

  async remove(id: string) {
    const wf = await this.repo.findOneBy({ id });
    if (wf) await this.repo.remove(wf);
    return { id, deleted: true };
  }
}
