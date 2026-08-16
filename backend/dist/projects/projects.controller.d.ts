import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
export declare class ProjectsController {
    private readonly projectsService;
    constructor(projectsService: ProjectsService);
    findAll(): Promise<import("../database/entities").ProjectEntity[]>;
    findOne(id: string): Promise<import("../database/entities").ProjectEntity>;
    create(dto: CreateProjectDto): Promise<import("../database/entities").ProjectEntity>;
    update(id: string, dto: Partial<CreateProjectDto>): Promise<import("../database/entities").ProjectEntity>;
    remove(id: string): Promise<{
        id: number;
        deleted: boolean;
    }>;
}
