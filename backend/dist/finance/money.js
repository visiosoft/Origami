"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundPct = exports.pctOf = exports.sumCents = exports.fromCents = exports.toCents = void 0;
exports.allocate = allocate;
const toCents = (v) => {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n))
        return 0;
    return Math.round((n + Math.sign(n) * Number.EPSILON) * 100);
};
exports.toCents = toCents;
const fromCents = (c) => Math.round(c) / 100;
exports.fromCents = fromCents;
const sumCents = (xs) => xs.reduce((a, b) => a + b, 0);
exports.sumCents = sumCents;
const pctOf = (cents, pct) => {
    const p = Number(pct) || 0;
    const raw = (cents * p) / 100;
    return Math.sign(raw) * Math.round(Math.abs(raw) + Number.EPSILON);
};
exports.pctOf = pctOf;
const roundPct = (p) => Math.round((Number(p) || 0) * 100) / 100;
exports.roundPct = roundPct;
function allocate(total, weights) {
    const out = weights.map(() => 0);
    const sum = (0, exports.sumCents)(weights.map((w) => Math.max(0, w)));
    if (!weights.length || sum <= 0 || total === 0)
        return out;
    weights.forEach((w, i) => { out[i] = Math.floor((total * Math.max(0, w)) / sum); });
    const rest = total - (0, exports.sumCents)(out);
    if (rest) {
        let largest = 0;
        weights.forEach((w, i) => { if (w > weights[largest])
            largest = i; });
        out[largest] += rest;
    }
    return out;
}
//# sourceMappingURL=money.js.map