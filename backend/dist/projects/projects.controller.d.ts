import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
export declare class ProjectsController {
    private readonly projectsService;
    constructor(projectsService: ProjectsService);
    findAll(): import("./projects.service").Project[];
    findOne(id: string): import("./projects.service").Project;
    create(dto: CreateProjectDto): import("./projects.service").Project;
    update(id: string, dto: Partial<CreateProjectDto>): import("./projects.service").Project;
}
