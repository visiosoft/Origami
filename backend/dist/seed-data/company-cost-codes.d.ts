export declare const COMPANY_COST_CODES: {
    code: string;
    name: string;
    description?: string;
}[];
export declare function costCodeId(code: string, name: string, taken: Set<string>): string;
