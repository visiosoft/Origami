import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
export declare class ProjectsController {
    private readonly projectsService;
    constructor(projectsService: ProjectsService);
    findAll(): any[] | Promise<import("../database/entities").ProjectEntity[]>;
    findOne(id: string): Promise<any>;
    create(dto: CreateProjectDto): any;
    update(id: string, dto: Partial<CreateProjectDto>): Promise<any>;
}
