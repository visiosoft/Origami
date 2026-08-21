import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities';
import { AuthService } from '../auth/auth.service';
export declare class UsersService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly auth;
    private readonly log;
    constructor(repo: Repository<UserEntity>, auth: AuthService);
    onApplicationBootstrap(): Promise<void>;
    findAll(): Promise<any[]>;
    create(dto: any): Promise<any>;
    resendInvite(id: string): Promise<any>;
    update(id: string, dto: any): Promise<any>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
