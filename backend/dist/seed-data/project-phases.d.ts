export interface PhaseDefinition {
    key: string;
    name: string;
    color: string;
    order: number;
}
export interface PhaseTaskTemplate {
    phaseKey: string;
    title: string;
    status: string;
    team: string;
    auto: boolean;
    autoLabel?: string;
    offsetDays: number;
    durationDays: number | null;
    deps: string[];
}
export declare const PHASE_DEFINITIONS: PhaseDefinition[];
export declare const RETIRED_PHASE_KEYS: string[];
export declare const TEMPLATE_STATUS: Record<string, string>;
export declare const DEMO_PHASE_TASKS: PhaseTaskTemplate[];
