"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_COOKIE = void 0;
exports.readCookie = readCookie;
exports.sessionCookieOptions = sessionCookieOptions;
exports.SESSION_COOKIE = 'origami_session';
function readCookie(header, name) {
    if (!header)
        return null;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq < 0)
            continue;
        if (part.slice(0, eq).trim() !== name)
            continue;
        try {
            return decodeURIComponent(part.slice(eq + 1).trim());
        }
        catch {
            return null;
        }
    }
    return null;
}
function sessionCookieOptions(maxAgeSeconds) {
    return {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV !== 'development',
        path: '/',
        maxAge: maxAgeSeconds * 1000,
    };
}
//# sourceMappingURL=cookie.util.js.map