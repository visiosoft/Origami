import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
export declare class RolesGuard implements CanActivate {
    private readonly reflector;
    private readonly log;
    private readonly audit;
    constructor(reflector: Reflector);
    canActivate(context: ExecutionContext): boolean;
    private deny;
}
