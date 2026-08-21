"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.passwordProblem = passwordProblem;
exports.randomToken = randomToken;
exports.hashToken = hashToken;
exports.signJwt = signJwt;
exports.verifyJwt = verifyJwt;
exports.signState = signState;
exports.readState = readState;
const crypto_1 = require("crypto");
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
function hashPassword(password) {
    const salt = (0, crypto_1.randomBytes)(16);
    const hash = (0, crypto_1.scryptSync)(password, salt, 64);
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
}
function verifyPassword(password, stored) {
    if (!stored || !stored.includes(':'))
        return false;
    const [saltHex, hashHex] = stored.split(':');
    try {
        const expected = Buffer.from(hashHex, 'hex');
        const actual = (0, crypto_1.scryptSync)(password, Buffer.from(saltHex, 'hex'), expected.length);
        return (0, crypto_1.timingSafeEqual)(expected, actual);
    }
    catch {
        return false;
    }
}
function passwordProblem(password) {
    if (!password || password.length < 8)
        return 'Password must be at least 8 characters.';
    if (!/[a-zA-Z]/.test(password))
        return 'Password must contain a letter.';
    if (!/[0-9]/.test(password))
        return 'Password must contain a number.';
    return null;
}
function randomToken() {
    return b64url((0, crypto_1.randomBytes)(32));
}
function hashToken(token) {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
}
function signJwt(claims, secret, ttlSeconds) {
    const now = Math.floor(Date.now() / 1000);
    const payload = { ...claims, iat: now, exp: now + ttlSeconds };
    const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
    const body = b64url(Buffer.from(JSON.stringify(payload)));
    const sig = b64url((0, crypto_1.createHmac)('sha256', secret).update(`${header}.${body}`).digest());
    return `${header}.${body}.${sig}`;
}
function verifyJwt(token, secret) {
    const parts = token?.split('.');
    if (!parts || parts.length !== 3)
        return null;
    const [header, body, sig] = parts;
    const expected = (0, crypto_1.createHmac)('sha256', secret).update(`${header}.${body}`).digest();
    const given = fromB64url(sig);
    if (given.length !== expected.length || !(0, crypto_1.timingSafeEqual)(given, expected))
        return null;
    try {
        const claims = JSON.parse(fromB64url(body).toString('utf8'));
        if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000))
            return null;
        return claims;
    }
    catch {
        return null;
    }
}
function signState(data, secret) {
    const body = b64url(Buffer.from(JSON.stringify({ ...data, t: Date.now() })));
    const sig = b64url((0, crypto_1.createHmac)('sha256', secret).update(body).digest()).slice(0, 32);
    return `${body}.${sig}`;
}
function readState(state, secret, maxAgeMs = 10 * 60_000) {
    const parts = state?.split('.');
    if (!parts || parts.length !== 2)
        return null;
    const [body, sig] = parts;
    const expected = b64url((0, crypto_1.createHmac)('sha256', secret).update(body).digest()).slice(0, 32);
    if (sig !== expected)
        return null;
    try {
        const data = JSON.parse(fromB64url(body).toString('utf8'));
        if (!data.t || Date.now() - data.t > maxAgeMs)
            return null;
        return data;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=crypto.util.js.map