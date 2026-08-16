import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAll(): Promise<import("../database/entities").UserEntity[]>;
    create(dto: CreateUserDto): Promise<import("../database/entities").UserEntity>;
    update(id: string, dto: Partial<CreateUserDto>): Promise<import("../database/entities").UserEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
