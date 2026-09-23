import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CsiCodeEntity } from '../database/entities';
export declare class CsiCodesService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly log;
    constructor(repo: Repository<CsiCodeEntity>);
    onApplicationBootstrap(): Promise<void>;
    findAll(): Promise<CsiCodeEntity[]>;
    create(dto: any): Promise<CsiCodeEntity>;
    update(id: string, dto: any): Promise<CsiCodeEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
