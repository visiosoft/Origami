import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RoleEntity } from '../database/entities';
export declare class RolesService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly log;
    constructor(repo: Repository<RoleEntity>);
    onApplicationBootstrap(): Promise<void>;
    findAll(): Promise<RoleEntity[]>;
    create(dto: any): Promise<RoleEntity>;
    update(key: string, dto: any): Promise<RoleEntity>;
    remove(key: string): Promise<{
        key: string;
        deleted: boolean;
    }>;
}
