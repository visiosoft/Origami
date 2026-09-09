import type { Branding } from './letterhead';
export interface DocRow {
    label: string;
    value?: string;
    budget?: string;
    actual?: string;
    notes?: string;
}
export interface DocBlock {
    title?: string;
    kind: 'fields' | 'table' | 'weeks' | 'list';
    note?: string;
    rows: DocRow[];
}
export interface DocStep {
    name: string;
    blurb?: string;
    blocks: DocBlock[];
    totals?: {
        budget: string;
        actual: string;
    };
}
export declare function buildProgramHtml(opts: {
    brand: Branding;
    projectName: string;
    subtitle?: string;
    date?: string;
    steps: DocStep[];
}): string;
