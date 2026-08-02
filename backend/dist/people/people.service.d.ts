import { CreatePersonDto } from './dto/create-person.dto';
export interface Person {
    id: string;
    name: string;
    kind: string;
    role: string;
    company?: string;
    phone?: string;
    email?: string;
    projects: string[];
    complianceDate?: string;
}
export declare class PeopleService {
    private people;
    findAll(project?: string): Person[];
    findOne(id: string): Person;
    create(dto: CreatePersonDto): Person;
}
