import { Repository } from 'typeorm';
import { PersonEntity, ProjectEntity, RoleEntity, UserEntity } from '../database/entities';
import type { SessionClaims } from './crypto.util';
export declare class ProjectAccessService {
    private readonly people;
    private readonly projects;
    private readonly roles?;
    private readonly users?;
    constructor(people: Repository<PersonEntity>, projects: Repository<ProjectEntity>, roles?: Repository<RoleEntity> | undefined, users?: Repository<UserEntity> | undefined);
    private cache;
    private assignedOnly;
    isStaff(claims: SessionClaims | null): boolean;
    allowedIds(claims: SessionClaims | null): Promise<'all' | Set<number>>;
    canSee(claims: SessionClaims | null, projectId: number | null | undefined): Promise<boolean>;
    assert(claims: SessionClaims | null, projectId: number | null | undefined): Promise<void>;
    assertStaff(claims: SessionClaims | null): void;
    filter<T>(claims: SessionClaims | null, rows: T[], projectIdOf: (row: T) => number | null | undefined): Promise<T[]>;
}
export declare class ProjectAccessModule {
}
