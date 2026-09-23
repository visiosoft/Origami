import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TradeEntity } from '../database/entities';
export declare class TradesService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly log;
    constructor(repo: Repository<TradeEntity>);
    onApplicationBootstrap(): Promise<void>;
    findAll(): Promise<TradeEntity[]>;
    create(dto: any): Promise<TradeEntity>;
    update(id: string, dto: any): Promise<TradeEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
