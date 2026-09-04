export declare class CreatePersonDto {
    id?: number;
    name: string;
    firstName?: string;
    lastName?: string;
    goByName?: string;
    pronouns?: string;
    gender?: string;
    categories?: string[];
    addresses?: Record<string, unknown>;
    contactInfo?: Record<string, unknown>;
    licenses?: unknown[];
    insurance?: Record<string, unknown>;
    notLicensedDesigner?: boolean;
    role?: string;
    company?: string;
    contact?: string;
    kind?: string;
    tier?: string;
    phone?: string;
    email?: string;
    projects?: string[];
    openTasks?: number;
    since?: string;
    last?: string;
    comply?: unknown;
}
