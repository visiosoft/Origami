import { PhasesService } from './phases.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
export declare class PhasesController {
    private readonly service;
    constructor(service: PhasesService);
    findAll(projectId: string): Promise<import("../database/entities").ProjectPhaseEntity[]>;
    board(projectId: string): Promise<{
        phases: import("../database/entities").ProjectPhaseEntity[];
        tasks: import("../database/entities").ProjectTaskEntity[];
    }> | {
        phases: never[];
        tasks: never[];
    };
    create(dto: CreatePhaseDto): Promise<import("../database/entities").ProjectPhaseEntity>;
    update(id: string, dto: Partial<CreatePhaseDto>): Promise<import("../database/entities").ProjectPhaseEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
