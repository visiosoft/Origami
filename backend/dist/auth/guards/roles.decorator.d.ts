export declare const ROLES_KEY = "auth:roles";
export declare const TIERS_KEY = "auth:tiers";
export declare const Roles: (...roleKeys: string[]) => import("@nestjs/common").CustomDecorator<string>;
export declare const Tiers: (...tiers: string[]) => import("@nestjs/common").CustomDecorator<string>;
