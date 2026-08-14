export interface ScoringOption {
    label: string;
    points: number;
}
export interface ScoringCriterion {
    key: string;
    order: number;
    name: string;
    subCriteria: string;
    maxPoints: number;
    options: ScoringOption[];
}
export declare const DEFAULT_SCORING: ScoringCriterion[];
