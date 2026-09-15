import { Repository } from 'typeorm';
import { GuestAccessEntity, UserEntity, ProjectEntity } from '../database/entities';
import { AuthService } from '../auth/auth.service';
import { SettingsService } from '../settings/settings.service';
import { PeopleService } from '../people/people.service';
export interface GuestActor {
    id?: string;
    name?: string;
}
export declare class GuestAccessService {
    private readonly repo;
    private readonly users;
    private readonly projects;
    private readonly auth;
    private readonly settings;
    private readonly people;
    constructor(repo: Repository<GuestAccessEntity>, users: Repository<UserEntity>, projects: Repository<ProjectEntity>, auth: AuthService, settings: SettingsService, people: PeopleService);
    list(projectId?: number): Promise<{
        id: number;
        name: string;
        email: string;
        tier: string;
        projectId: number;
        createdAt: string;
        expiresAt: string;
        createdBy: string;
        revokedAt: string;
        lastUsedAt: string;
        expired: boolean;
        hasFullAccount: boolean;
    }[]>;
    create(input: {
        name: string;
        email: string;
        tier: 'client' | 'consultant';
        projectId: number;
        days?: number;
    }, actor?: GuestActor): Promise<{
        id: number;
        name: string;
        email: string;
        tier: "client" | "consultant";
        projectId: number;
        projectName: string;
        expiresAt: string;
        link: string;
    }>;
    revoke(id: number): Promise<{
        id: number;
        revokedAt: string;
    }>;
    promote(id: number): Promise<{
        sent: true;
        to: string;
        url: string;
        error?: undefined;
    } | {
        sent: false;
        to: string;
        url: string;
        error: string;
    }>;
    resolveToken(token: string): Promise<{
        token: string;
        expiresIn: number;
        user: any;
    }>;
}
