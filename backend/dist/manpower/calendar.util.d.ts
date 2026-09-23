export declare const addDays: (d: string, n: number) => string;
export declare const daysBetween: (from: string, to: string) => number;
export declare const weekday: (d: string) => number;
export declare function eachDate(from: string, to: string): string[];
export declare function workingDays(from: string, to: string, weekendDays: number[], holidays: Set<string>): string[];
export declare function overlap(a1: string, a2: string, b1: string, b2: string): [string, string] | null;
export declare function shiftOn(a: {
    templateIds: string[];
    rotateEveryDays?: number | null;
    startDate: string;
    endDate?: string | null;
}, date: string): string | null;
export declare const yearOf: (d: string) => number;
