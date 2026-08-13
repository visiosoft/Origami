import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProjectEntity, PersonEntity, TaskEntity, DealEntity, InvoiceEntity, FinanceEntity } from './entities';
export declare class SeedService implements OnApplicationBootstrap {
    private projects;
    private people;
    private tasks;
    private deals;
    private invoices;
    private finance;
    private readonly log;
    constructor(projects: Repository<ProjectEntity>, people: Repository<PersonEntity>, tasks: Repository<TaskEntity>, deals: Repository<DealEntity>, invoices: Repository<InvoiceEntity>, finance: Repository<FinanceEntity>);
    onApplicationBootstrap(): Promise<void>;
    private seed;
}
