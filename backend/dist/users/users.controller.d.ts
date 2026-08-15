import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAll(): Promise<import("../seed-data/users").UserSeed[] | import("../database/entities").UserEntity[]>;
    create(dto: CreateUserDto): any;
    update(id: string, dto: Partial<CreateUserDto>): Promise<import("../database/entities").UserEntity | import("../seed-data/users").UserSeed | undefined>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
