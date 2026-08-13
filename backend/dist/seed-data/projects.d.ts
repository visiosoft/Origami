export interface Project {
    id: number;
    priority: 'High' | 'Medium' | 'Low';
    name: string;
    location: string;
    typeOfWork: string;
    contractType: string;
    contractAmt: string;
    estStart: string;
    duration: string;
    scope: string;
    stage: 'Leads' | 'Design' | 'Construction' | 'Closeout';
    progress: number;
    referral: string;
    contactedBy: string;
    imgColor: string;
    img: string;
}
export declare const PROJECTS: Project[];
export declare const STAGE_CONFIG: readonly [{
    readonly name: "Leads";
    readonly color: "#7E9B93";
}, {
    readonly name: "Design";
    readonly color: "#245C3A";
}, {
    readonly name: "Construction";
    readonly color: "#173326";
}, {
    readonly name: "Closeout";
    readonly color: "#0F2417";
}];
export declare const PR_COLORS: Record<string, {
    bg: string;
    c: string;
}>;
export interface WfTask {
    title: string;
    status: 'Done' | 'Open' | 'In Progress';
    auto: boolean;
    assignee: string;
    team: string;
    autoLabel?: string;
    start: string;
    end: string;
    dur: string;
    deps: string[];
}
export interface WfPhase {
    id: string;
    name: string;
    color: string;
    start: string;
    end: string;
    tasks: WfTask[];
}
export declare const PROJECT_WORKFLOW: WfPhase[];
export declare const TEAM_COLORS: Record<string, string>;
export declare const TEAM_BGS: Record<string, string>;
export declare const WF_ST_COLORS: Record<string, {
    bg: string;
    c: string;
}>;
export interface ComputedPhase extends WfPhase {
    count: number;
    doneCount: number;
    progress: number;
    locked: boolean;
    isComplete: boolean;
    isLocked: boolean;
    isActive: boolean;
    statusLabel: string;
    statusBg: string;
    statusC: string;
    headerOpacity: string;
}
export declare function computeWorkflow(): ComputedPhase[];
