import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserEntity, ProjectTaskEntity, TaskEntity } from '../database/entities';
import { AuthService } from '../auth/auth.service';
export declare class UsersService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly projectTasks;
    private readonly tasks;
    private readonly auth;
    private readonly log;
    constructor(repo: Repository<UserEntity>, projectTasks: Repository<ProjectTaskEntity>, tasks: Repository<TaskEntity>, auth: AuthService);
    onApplicationBootstrap(): Promise<void>;
    findAll(): Promise<any[]>;
    private assertEmailFree;
    create(dto: any): Promise<any>;
    resendInvite(id: string): Promise<any>;
    update(id: string, dto: any): Promise<any>;
    private renameOnTasks;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
