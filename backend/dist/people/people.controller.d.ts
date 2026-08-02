import { PeopleService } from './people.service';
import { CreatePersonDto } from './dto/create-person.dto';
export declare class PeopleController {
    private readonly peopleService;
    constructor(peopleService: PeopleService);
    findAll(project?: string): import("./people.service").Person[];
    findOne(id: string): import("./people.service").Person;
    create(dto: CreatePersonDto): import("./people.service").Person;
}
