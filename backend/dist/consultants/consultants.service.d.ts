import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ConsultantEntity } from '../database/entities';
export declare class ConsultantsService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly log;
    constructor(repo: Repository<ConsultantEntity>);
    onApplicationBootstrap(): Promise<void>;
    findAll(): Promise<ConsultantEntity[]>;
    create(dto: Partial<ConsultantEntity>): Promise<ConsultantEntity>;
    update(id: string, dto: Partial<ConsultantEntity>): Promise<ConsultantEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
