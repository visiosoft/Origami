import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserEntity } from './entities';
export interface ResolvedAssignee {
    id: string | null;
    name: string;
}
export declare function resolveAssignee(users: Repository<UserEntity>, input: {
    id?: string | null;
    name?: string | null;
}): Promise<ResolvedAssignee>;
export declare function backfillAssignees<T extends Record<string, any>>(tasks: Repository<any>, users: Repository<UserEntity>, idField: string, nameField: string, log: Logger): Promise<void>;
