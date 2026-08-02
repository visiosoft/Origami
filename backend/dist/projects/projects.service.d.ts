import { CreateProjectDto } from './dto/create-project.dto';
export interface Project {
    id: string;
    name: string;
    client: string;
    phase: string;
    contractValue: number;
    exec?: string;
    contractType?: string;
}
export declare class ProjectsService {
    private projects;
    findAll(): Project[];
    findOne(id: string): Project;
    create(dto: CreateProjectDto): Project;
    update(id: string, dto: Partial<CreateProjectDto>): Project;
}
