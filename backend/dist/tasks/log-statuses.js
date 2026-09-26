"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isClosedStatus = exports.DEFAULT_LOG_STATUSES = exports.LOG_STATUSES_KEY = void 0;
exports.parseLogStatuses = parseLogStatuses;
exports.LOG_STATUSES_KEY = 'requestLog.statuses';
exports.DEFAULT_LOG_STATUSES = [
    { name: 'Open' }, { name: 'In Progress' }, { name: 'On hold' }, { name: 'Closed', closed: true },
];
const COLOR = /^#[0-9a-f]{6}$/i;
function parseLogStatuses(raw) {
    let list = raw;
    if (typeof raw === 'string') {
        try {
            list = raw.trim() ? JSON.parse(raw) : null;
        }
        catch {
            list = null;
        }
    }
    if (!Array.isArray(list))
        return exports.DEFAULT_LOG_STATUSES;
    const seen = new Set();
    const out = [];
    for (const s of list) {
        const name = String(s?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 30);
        if (!name || seen.has(name.toLowerCase()))
            continue;
        seen.add(name.toLowerCase());
        const color = String(s?.color || '');
        out.push({ name, ...(s?.closed ? { closed: true } : {}), ...(COLOR.test(color) ? { color } : {}) });
        if (out.length >= 12)
            break;
    }
    if (!out.length)
        return exports.DEFAULT_LOG_STATUSES;
    if (!out.some((s) => s.name === 'Open'))
        out.unshift({ name: 'Open' });
    if (!out.some((s) => s.closed)) {
        const c = out.find((s) => s.name === 'Closed');
        if (c)
            c.closed = true;
        else
            out.push({ name: 'Closed', closed: true });
    }
    return out;
}
const isClosedStatus = (list, status) => list.some((s) => s.closed && s.name === status);
exports.isClosedStatus = isClosedStatus;
//# sourceMappingURL=log-statuses.js.map