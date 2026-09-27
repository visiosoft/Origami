import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AppSettingEntity, RoleEntity } from '../database/entities';
export declare const SITE_SUPER_TRIM_KEY = "roles.siteSuperTrimmed.v2";
export declare class RolesService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly settings;
    private readonly log;
    constructor(repo: Repository<RoleEntity>, settings: Repository<AppSettingEntity>);
    onApplicationBootstrap(): Promise<void>;
    trimSiteSuper(): Promise<void>;
    findAll(): Promise<RoleEntity[]>;
    create(dto: any): Promise<RoleEntity>;
    update(key: string, dto: any): Promise<RoleEntity>;
    remove(key: string): Promise<{
        key: string;
        deleted: boolean;
    }>;
}
