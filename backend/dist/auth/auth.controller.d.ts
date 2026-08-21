import { AuthService } from './auth.service';
import { LoginDto, SetPasswordDto, ForgotPasswordDto } from './dto/auth.dto';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    login(dto: LoginDto): Promise<{
        token: string;
        expiresIn: number;
        user: any;
    }>;
    invite(token: string): Promise<{
        name: string;
        email: string;
        isReset: boolean;
    }>;
    setPassword(dto: SetPasswordDto): Promise<{
        ok: boolean;
        email: string;
    }>;
    forgot(dto: ForgotPasswordDto): Promise<{
        ok: boolean;
    }>;
    me(authorization?: string): Promise<any>;
}
