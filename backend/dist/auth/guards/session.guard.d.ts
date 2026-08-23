import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
export type AuthedRequest = Request & {
    claims?: import('../crypto.util').SessionClaims;
};
export declare class SessionGuard implements CanActivate {
    private readonly reflector;
    private readonly auth;
    private readonly log;
    private readonly audit;
    constructor(reflector: Reflector, auth: AuthService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private resolve;
}
