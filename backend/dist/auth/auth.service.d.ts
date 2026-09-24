import { Repository } from 'typeorm';
import { UserEntity, RoleEntity, GuestAccessEntity, EmployeeEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService, type GoogleProfile } from '../google/google.service';
import { type SessionClaims } from './crypto.util';
export declare function publicUser(u: UserEntity): any;
export declare class AuthService {
    private readonly users;
    private readonly roles;
    private readonly guestAccess;
    private readonly settings;
    private readonly google;
    private readonly employees?;
    private readonly log;
    constructor(users: Repository<UserEntity>, roles: Repository<RoleEntity>, guestAccess: Repository<GuestAccessEntity>, settings: SettingsService, google: GoogleService, employees?: Repository<EmployeeEntity> | undefined);
    private isSuperintendent;
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
        ok: false;
        reason: "unavailable";
    } | {
        ok: true;
        reason?: undefined;
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
    issueSession(user: UserEntity): Promise<{
        token: string;
        expiresIn: number;
        user: any;
    }>;
    verify(bearer: string | undefined): Promise<SessionClaims | null>;
    private guestGrantLive;
    actor(bearer: string | undefined): Promise<{
        name: string;
        id?: string;
    }>;
    requireActor(bearer: string | undefined): Promise<{
        name: string;
        id?: string;
    }>;
    me(bearer: string | undefined): Promise<any>;
    setNotificationPrefs(bearer: string | undefined, prefs: {
        notifyOnAssignment?: boolean;
        notifyByEmail?: boolean;
        notifyBySms?: boolean;
        notifyOnOverdue?: boolean;
        notifyOnMilestone?: boolean;
        digestFrequency?: string;
    }): Promise<any>;
    connectMyCalendar(userId: string, refreshToken: string, email: string): Promise<void>;
    disconnectMyCalendar(userId: string): Promise<void>;
    myCalendarStatus(userId: string): Promise<{
        connected: boolean;
        email: string;
        connectedAt: string;
    }>;
    myCalendarCredentials(userId: string): Promise<{
        refreshToken: string;
    } | null>;
    findByEmail(email: string): Promise<UserEntity | null>;
}
