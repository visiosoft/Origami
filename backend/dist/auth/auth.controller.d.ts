import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, SetPasswordDto, ForgotPasswordDto } from './dto/auth.dto';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    login(dto: LoginDto, res: Response): Promise<{
        token: string;
        expiresIn: number;
        user: any;
    }>;
    logout(res: Response): {
        ok: boolean;
    };
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
        ok: false;
        reason: "unavailable";
    } | {
        ok: true;
        reason?: undefined;
    }>;
    me(authorization?: string): Promise<any>;
}
