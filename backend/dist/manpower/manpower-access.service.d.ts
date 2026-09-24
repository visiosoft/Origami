import { Repository } from 'typeorm';
import { RoleEntity } from '../database/entities';
import { AuthService } from '../auth/auth.service';
export interface Actor {
    name: string;
    id?: string;
    roleKey?: string;
}
export declare class ManpowerAccess {
    private readonly roles;
    private readonly auth;
    constructor(roles: Repository<RoleEntity>, auth: AuthService);
    actor(bearer: string | undefined): Promise<Actor>;
    can(actor: Actor, moduleKey: string, action?: 'view' | 'manage'): Promise<boolean>;
    permissionsOf(actor: Actor): Promise<Record<string, {
        view?: boolean;
        manage?: boolean;
    }> | 'all' | null>;
    require(actor: Actor, moduleKey: string, what: string): Promise<void>;
}
export declare const HR_MODULE = "manpower_con";
export declare const FINANCE_MODULE = "fin_resources";
