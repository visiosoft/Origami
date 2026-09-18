export interface TemplateTask {
    id: string;
    title: string;
    days?: number;
    team: string;
    labels: string[];
    dependsOn?: string[];
}
export interface TemplatePhase {
    key: string;
    name: string;
    color: string;
    gated?: boolean;
    dependsOn?: string[];
    weeks?: number;
    tasks: TemplateTask[];
}
export declare const DEFAULT_PROGRAMME: TemplatePhase[];
export declare const TEMPLATE_TEAMS: string[];
export declare const TEMPLATE_LABELS: string[];
export declare function parseProgramme(raw: string | null | undefined): TemplatePhase[] | null;
export type TemplateCategory = 'design' | 'construction';
export interface ProgrammeTemplateDef {
    key: string;
    name: string;
    phases: TemplatePhase[];
    projectTypes?: string[];
    category?: TemplateCategory;
}
export declare const DEFAULT_TEMPLATE_KEY = "default";
export declare const DEFAULT_LIBRARY: ProgrammeTemplateDef[];
export declare const slugifyTemplateKey: (name: string) => string;
export declare function parseLibrary(raw: string | null | undefined): ProgrammeTemplateDef[] | null;
