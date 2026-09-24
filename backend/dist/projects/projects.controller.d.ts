import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectAccessService } from '../auth/project-access.service';
import type { SessionClaims } from '../auth/crypto.util';
export declare class ProjectsController {
    private readonly projectsService;
    private readonly access;
    constructor(projectsService: ProjectsService, access: ProjectAccessService);
    findAll(claims: SessionClaims | null): Promise<any[]>;
    findOne(id: string, claims: SessionClaims | null): Promise<import("../database/entities").ProjectEntity>;
    create(dto: CreateProjectDto): Promise<import("../database/entities").ProjectEntity>;
    update(id: string, dto: Partial<CreateProjectDto>): Promise<import("../database/entities").ProjectEntity>;
    remove(id: string): Promise<{
        id: number;
        deleted: boolean;
    }>;
}
