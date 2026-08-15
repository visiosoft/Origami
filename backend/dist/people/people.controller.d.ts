import { PeopleService } from './people.service';
import { CreatePersonDto } from './dto/create-person.dto';
export declare class PeopleController {
    private readonly peopleService;
    constructor(peopleService: PeopleService);
    findAll(project?: string): Promise<any[]>;
    findOne(id: string): Promise<any>;
    create(dto: CreatePersonDto): Promise<any>;
    update(id: string, dto: Partial<CreatePersonDto>): Promise<any>;
    remove(id: string): Promise<{
        id: number;
        deleted: boolean;
    }>;
}
