import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities';
import { UserSeed } from '../seed-data/users';
export declare class UsersService implements OnApplicationBootstrap {
    private readonly repo?;
    private readonly log;
    private mem;
    constructor(repo?: Repository<UserEntity> | undefined);
    onApplicationBootstrap(): Promise<void>;
    findAll(): Promise<UserSeed[] | UserEntity[]>;
    create(dto: any): any;
    update(id: string, dto: any): Promise<UserEntity | UserSeed | undefined>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
