import type { CookieOptions } from 'express';
export declare const SESSION_COOKIE = "origami_session";
export declare function readCookie(header: string | undefined, name: string): string | null;
export declare function sessionCookieOptions(maxAgeSeconds: number): CookieOptions;
