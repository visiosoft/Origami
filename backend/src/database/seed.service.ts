import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProjectEntity, PersonEntity, TaskEntity, DealEntity, InvoiceEntity, FinanceEntity,
} from './entities';
import { PROJECTS } from '../seed-data/projects';
import { PEOPLE } from '../seed-data/people';
import { ALL_TASKS } from '../seed-data/tasks';
import { DEALS } from '../seed-data/pipeline';
import { INVOICES, FINANCE } from '../seed-data/dashboard';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly log = new Logger('SeedService');

  constructor(
    @InjectRepository(ProjectEntity) private projects: Repository<ProjectEntity>,
    @InjectRepository(PersonEntity) private people: Repository<PersonEntity>,
    @InjectRepository(TaskEntity) private tasks: Repository<TaskEntity>,
    @InjectRepository(DealEntity) private deals: Repository<DealEntity>,
    @InjectRepository(InvoiceEntity) private invoices: Repository<InvoiceEntity>,
    @InjectRepository(FinanceEntity) private finance: Repository<FinanceEntity>,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.seed();
    } catch (err) {
      this.log.error('Seeding failed: ' + (err as Error).message);
    }
  }

  private async seed() {
    if ((await this.projects.count()) === 0) {
      await this.projects.save(PROJECTS as unknown as ProjectEntity[]);
      this.log.log(`Seeded ${PROJECTS.length} projects`);
    }
    if ((await this.people.count()) === 0) {
      await this.people.save(PEOPLE as unknown as PersonEntity[]);
      this.log.log(`Seeded ${PEOPLE.length} people`);
    }
    if ((await this.tasks.count()) === 0) {
      const rows: Partial<TaskEntity>[] = [];
      (['internal', 'owner', 'subcontractor'] as const).forEach((tab) => {
        ALL_TASKS[tab].forEach((t) => rows.push({ ...t, tab }));
      });
      await this.tasks.save(rows as TaskEntity[]);
      this.log.log(`Seeded ${rows.length} tasks`);
    }
    if ((await this.deals.count()) === 0) {
      await this.deals.save(DEALS as unknown as DealEntity[]);
      this.log.log(`Seeded ${DEALS.length} deals`);
    }
    if ((await this.invoices.count()) === 0) {
      const rows: Partial<InvoiceEntity>[] = [];
      (['internal', 'client', 'consultant'] as const).forEach((kind) => {
        INVOICES[kind].forEach((inv) => rows.push({ invId: inv.id, kind, project: inv.project, month: inv.month, issued: inv.issued, amount: inv.amount, paid: inv.paid }));
      });
      await this.invoices.save(rows as InvoiceEntity[]);
      this.log.log(`Seeded ${rows.length} invoices`);
    }
    if ((await this.finance.count()) === 0) {
      await this.finance.save(FINANCE as unknown as FinanceEntity[]);
      this.log.log(`Seeded ${FINANCE.length} finance rows`);
    }
  }
}
