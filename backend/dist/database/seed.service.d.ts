import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProjectEntity, PersonEntity, TaskEntity, DealEntity, InvoiceEntity, FinanceEntity, AppSettingEntity } from './entities';
export declare class SeedService implements OnApplicationBootstrap {
    private projects;
    private people;
    private tasks;
    private deals;
    private invoices;
    private finance;
    private settings;
    private readonly log;
    constructor(projects: Repository<ProjectEntity>, people: Repository<PersonEntity>, tasks: Repository<TaskEntity>, deals: Repository<DealEntity>, invoices: Repository<InvoiceEntity>, finance: Repository<FinanceEntity>, settings: Repository<AppSettingEntity>);
    onApplicationBootstrap(): Promise<void>;
    private seed;
    private seedBrandDefaults;
}
