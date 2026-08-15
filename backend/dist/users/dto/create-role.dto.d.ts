import { UserTier } from './create-user.dto';
export declare class CreateRoleDto {
    key?: string;
    name: string;
    description?: string;
    tier: UserTier;
    order?: number;
    isSystem?: boolean;
    permissions?: Record<string, {
        view: boolean;
        manage: boolean;
    }>;
}
