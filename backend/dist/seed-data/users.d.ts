export type Tier = 'internal' | 'client' | 'consultant';
export type Action = 'view' | 'manage';
export type RolePermissions = Record<string, {
    view: boolean;
    manage: boolean;
}>;
export interface RoleSeed {
    key: string;
    name: string;
    description: string;
    tier: Tier;
    order: number;
    isSystem: boolean;
    permissions: RolePermissions;
}
export interface UserSeed {
    id: string;
    name: string;
    email: string;
    tier: Tier;
    roleKey: string;
    status: 'pending' | 'active' | 'suspended';
    lastLogin?: string;
    createdAt: string;
}
export declare const MODULE_KEYS: string[];
export declare const DEFAULT_ROLES: RoleSeed[];
export declare const DEFAULT_USERS: UserSeed[];
