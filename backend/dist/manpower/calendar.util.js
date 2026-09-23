"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.yearOf = exports.weekday = exports.daysBetween = exports.addDays = void 0;
exports.eachDate = eachDate;
exports.workingDays = workingDays;
exports.overlap = overlap;
exports.shiftOn = shiftOn;
const DAY = 86400000;
const ms = (d) => Date.parse(d + 'T00:00:00Z');
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const addDays = (d, n) => iso(ms(d) + n * DAY);
exports.addDays = addDays;
const daysBetween = (from, to) => Math.round((ms(to) - ms(from)) / DAY);
exports.daysBetween = daysBetween;
const weekday = (d) => new Date(ms(d)).getUTCDay();
exports.weekday = weekday;
function eachDate(from, to) {
    const out = [];
    for (let t = ms(from); t <= ms(to); t += DAY)
        out.push(iso(t));
    return out;
}
function workingDays(from, to, weekendDays, holidays) {
    if (to < from)
        return [];
    return eachDate(from, to).filter((d) => !weekendDays.includes((0, exports.weekday)(d)) && !holidays.has(d));
}
function overlap(a1, a2, b1, b2) {
    const s = a1 > b1 ? a1 : b1;
    const e = a2 < b2 ? a2 : b2;
    return s <= e ? [s, e] : null;
}
function shiftOn(a, date) {
    if (!a.templateIds?.length || date < a.startDate || (a.endDate && date > a.endDate))
        return null;
    if (a.templateIds.length === 1)
        return a.templateIds[0];
    const every = Math.max(1, Number(a.rotateEveryDays) || 7);
    return a.templateIds[Math.floor((0, exports.daysBetween)(a.startDate, date) / every) % a.templateIds.length];
}
const yearOf = (d) => Number(d.slice(0, 4));
exports.yearOf = yearOf;
//# sourceMappingURL=calendar.util.js.map