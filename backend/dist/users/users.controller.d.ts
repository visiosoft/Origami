import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAll(): Promise<any[]>;
    create(dto: CreateUserDto): Promise<any>;
    resendInvite(id: string): Promise<any>;
    update(id: string, dto: Partial<CreateUserDto>): Promise<any>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
