import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities';
export declare class UsersService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly log;
    constructor(repo: Repository<UserEntity>);
    onApplicationBootstrap(): Promise<void>;
    findAll(): Promise<UserEntity[]>;
    create(dto: any): Promise<UserEntity>;
    update(id: string, dto: any): Promise<UserEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
