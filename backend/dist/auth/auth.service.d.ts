import { Repository } from 'typeorm';
import { UserEntity, RoleEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService, type GoogleProfile } from '../google/google.service';
import { type SessionClaims } from './crypto.util';
export declare function publicUser(u: UserEntity): any;
export declare class AuthService {
    private readonly users;
    private readonly roles;
    private readonly settings;
    private readonly google;
    private readonly log;
    constructor(users: Repository<UserEntity>, roles: Repository<RoleEntity>, settings: SettingsService, google: GoogleService);
    private ensureFounderAdmin;
    ensureBootstrapAdmin(): Promise<void>;
    sendInvite(user: UserEntity, kind?: 'invite' | 'reset'): Promise<{
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
    readInvite(token: string): Promise<{
        name: string;
        email: string;
        isReset: boolean;
    }>;
    setPassword(token: string, password: string): Promise<{
        ok: boolean;
        email: string;
    }>;
    forgotPassword(email: string): Promise<{
        ok: boolean;
    }>;
    login(email: string, password: string): Promise<{
        token: string;
        expiresIn: number;
        user: any;
    }>;
    loginWithGoogle(profile: GoogleProfile): Promise<{
        token: string;
        expiresIn: number;
        user: any;
    }>;
    private issueSession;
    verify(bearer: string | undefined): Promise<SessionClaims | null>;
    actor(bearer: string | undefined): Promise<{
        name: string;
        id?: string;
    }>;
    requireActor(bearer: string | undefined): Promise<{
        name: string;
        id?: string;
    }>;
    me(bearer: string | undefined): Promise<any>;
    findByEmail(email: string): Promise<UserEntity | null>;
}
