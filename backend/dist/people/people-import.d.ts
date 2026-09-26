import type { PersonEntity } from '../database/entities';
export declare const IMPORT_COLUMNS: {
    key: string;
    header: string;
    hint: string;
}[];
export declare function isoDate(v: string): string;
export declare function mapHeaders(row: Record<string, unknown>): Record<string, string>;
export interface ImportPlanRow {
    row: number;
    action: 'create' | 'update' | 'skip' | 'error';
    name: string;
    kind: string;
    email: string;
    matchId?: number;
    issues: string[];
    person?: Record<string, unknown>;
}
export declare function planImport(rows: Record<string, unknown>[], existing: Pick<PersonEntity, 'id' | 'name' | 'kind' | 'email'>[], projectNames: string[], opts: {
    update: boolean;
}): ImportPlanRow[];
