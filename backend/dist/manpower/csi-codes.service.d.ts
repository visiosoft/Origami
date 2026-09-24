import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CsiCodeEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
export declare function companyRows(): CsiCodeEntity[];
export declare class CsiCodesService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly settings?;
    private readonly log;
    constructor(repo: Repository<CsiCodeEntity>, settings?: SettingsService | undefined);
    onApplicationBootstrap(): Promise<void>;
    adoptCompanyList(): Promise<void>;
    findAll(): Promise<CsiCodeEntity[]>;
    create(dto: any): Promise<CsiCodeEntity>;
    update(id: string, dto: any): Promise<CsiCodeEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
