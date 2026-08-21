export declare function hashPassword(password: string): string;
export declare function verifyPassword(password: string, stored: string | null | undefined): boolean;
export declare function passwordProblem(password: string): string | null;
export declare function randomToken(): string;
export declare function hashToken(token: string): string;
export interface SessionClaims {
    sub: string;
    email: string;
    name: string;
    roleKey: string;
    tier: string;
    iat: number;
    exp: number;
}
export declare function signJwt(claims: Omit<SessionClaims, 'iat' | 'exp'>, secret: string, ttlSeconds: number): string;
export declare function verifyJwt(token: string, secret: string): SessionClaims | null;
export declare function signState(data: Record<string, unknown>, secret: string): string;
export declare function readState(state: string, secret: string, maxAgeMs?: number): Record<string, any> | null;
