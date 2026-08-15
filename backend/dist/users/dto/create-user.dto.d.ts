export declare enum UserTier {
    Internal = "internal",
    Client = "client",
    Consultant = "consultant"
}
export declare enum UserStatus {
    Pending = "pending",
    Active = "active",
    Suspended = "suspended"
}
export declare class CreateUserDto {
    id?: string;
    name: string;
    email: string;
    tier: UserTier;
    roleKey: string;
    status?: UserStatus;
    lastLogin?: string;
}
