export interface Comply {
    label: string;
    date: string;
    ok: boolean;
    extra: string;
}
export interface Person {
    id: number;
    name: string;
    role: string;
    company: string;
    contact?: string;
    kind: 'Staff' | 'Client' | 'Consultant' | 'Sub' | 'Authority' | 'Vendor';
    tier: 'Internal' | 'Client' | 'Consultant';
    phone: string;
    email: string;
    projects: string[];
    openTasks: number;
    since: string;
    comply: Comply | null;
    last: string;
}
export declare const KIND_STYLE: Record<string, {
    bg: string;
    c: string;
}>;
export declare const TIER_STYLE: Record<string, {
    bg: string;
    c: string;
}>;
export declare const KIND_C: Record<string, string>;
export declare const COMPANY_META: Record<string, {
    line: string;
    address: string;
    trade: string;
    billing: string;
}>;
export declare const PEOPLE: Person[];
export declare const initials: (n: string) => string;
