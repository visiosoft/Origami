import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RoleEntity } from '../database/entities';
export declare class RolesService implements OnApplicationBootstrap {
    private readonly repo?;
    private readonly log;
    private mem;
    constructor(repo?: Repository<RoleEntity> | undefined);
    onApplicationBootstrap(): Promise<void>;
    findAll(): Promise<RoleEntity[]>;
    create(dto: any): any;
    update(key: string, dto: any): Promise<RoleEntity | undefined>;
    remove(key: string): Promise<{
        key: string;
        deleted: boolean;
    }>;
}
