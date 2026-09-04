export interface TemplateTask {
    id: string;
    title: string;
    team: string;
    labels: string[];
}
export interface TemplatePhase {
    key: string;
    name: string;
    color: string;
    tasks: TemplateTask[];
}
export declare const DEFAULT_PROGRAMME: TemplatePhase[];
export declare const TEMPLATE_TEAMS: string[];
export declare const TEMPLATE_LABELS: string[];
export declare function parseProgramme(raw: string | null | undefined): TemplatePhase[] | null;
