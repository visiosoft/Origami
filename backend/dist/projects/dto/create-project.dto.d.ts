export declare enum ProjectPhase {
    Design = "Design",
    Preconstruction = "Preconstruction",
    Construction = "Construction",
    Closeout = "Closeout"
}
export declare class CreateProjectDto {
    name: string;
    client: string;
    phase: ProjectPhase;
    contractValue: number;
    exec?: string;
    contractType?: string;
}
