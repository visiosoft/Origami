import { PeopleService } from './people.service';
import { CreatePersonDto } from './dto/create-person.dto';
export declare class PeopleController {
    private readonly peopleService;
    constructor(peopleService: PeopleService);
    findAll(project?: string): Promise<import("../database/entities").PersonEntity[]>;
    findOne(id: string): Promise<import("../database/entities").PersonEntity>;
    create(dto: CreatePersonDto): Promise<import("../database/entities").PersonEntity>;
    update(id: string, dto: Partial<CreatePersonDto>): Promise<import("../database/entities").PersonEntity>;
    remove(id: string): Promise<{
        id: number;
        deleted: boolean;
    }>;
}
