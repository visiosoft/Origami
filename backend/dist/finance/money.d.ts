export declare const toCents: (v: number | string | null | undefined) => number;
export declare const fromCents: (c: number) => number;
export declare const sumCents: (xs: number[]) => number;
export declare const pctOf: (cents: number, pct: number | null | undefined) => number;
export declare const roundPct: (p: number) => number;
export declare function allocate(total: number, weights: number[]): number[];
