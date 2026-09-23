import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ContractorEntity, SubcontractorTradeEntity } from '../database/entities';
import { ManpowerAccess, type Actor } from './manpower-access.service';
export declare const SUBTRADE_CATEGORIES: string[];
export declare class SubcontractorTradesService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly contractors;
    private readonly access;
    private readonly log;
    constructor(repo: Repository<SubcontractorTradeEntity>, contractors: Repository<ContractorEntity>, access: ManpowerAccess);
    onApplicationBootstrap(): Promise<void>;
    findAll(): Promise<SubcontractorTradeEntity[]>;
    private check;
    create(dto: Partial<SubcontractorTradeEntity>, actor: Actor): Promise<SubcontractorTradeEntity>;
    update(id: string, dto: Partial<SubcontractorTradeEntity>, actor: Actor): Promise<SubcontractorTradeEntity>;
    remove(id: string, actor: Actor): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
