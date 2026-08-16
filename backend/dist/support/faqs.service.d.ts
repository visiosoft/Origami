import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FaqEntity } from '../database/entities';
export declare class FaqsService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly log;
    constructor(repo: Repository<FaqEntity>);
    onApplicationBootstrap(): Promise<void>;
    findAll(): Promise<FaqEntity[]>;
    create(dto: any): Promise<FaqEntity>;
    update(id: string, dto: any): Promise<FaqEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
