"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isClosedStatus = exports.isInProgress = exports.LOG_BUCKETS = exports.LOG_START = exports.DEFAULT_LOG_STATUSES = exports.LOG_STATUSES_KEY = void 0;
exports.bucketOf = bucketOf;
exports.withBuckets = withBuckets;
exports.parseLogStatuses = parseLogStatuses;
exports.LOG_STATUSES_KEY = 'requestLog.statuses';
exports.DEFAULT_LOG_STATUSES = [
    { name: 'To Do' }, { name: 'Assigned' }, { name: 'In Progress' }, { name: 'On hold' },
    { name: 'Complete', closed: true }, { name: 'Confirmed', closed: true },
];
exports.LOG_START = 'To Do';
exports.LOG_BUCKETS = exports.DEFAULT_LOG_STATUSES.map((s) => s.name);
function bucketOf(status, hasAssignee) {
    const s = String(status || '').trim().toLowerCase();
    if (s === 'open' || s === 'not started' || s === 'to do' || s === 'todo')
        return hasAssignee ? 'Assigned' : 'To Do';
    if (s === 'closed' || s === 'done')
        return 'Complete';
    return status;
}
const isInProgress = (status) => /^in[\s-]*progress$/i.test(String(status || '').trim());
exports.isInProgress = isInProgress;
function withBuckets(list) {
    const renamed = list.map((s) => (s.name === 'Open' ? { ...s, name: 'To Do' } : s.name === 'Closed' ? { ...s, name: 'Complete', closed: true } : s));
    const extra = renamed.filter((s) => !exports.LOG_BUCKETS.includes(s.name));
    const buckets = exports.DEFAULT_LOG_STATUSES.map((b) => ({ ...b, ...(renamed.find((s) => s.name === b.name)?.color ? { color: renamed.find((s) => s.name === b.name).color } : {}) }));
    const at = buckets.findIndex((b) => b.name === 'Complete');
    return [...buckets.slice(0, at), ...extra, ...buckets.slice(at)];
}
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
    return withBuckets(out).slice(0, 12);
}
const isClosedStatus = (list, status) => list.some((s) => s.closed && s.name === status);
exports.isClosedStatus = isClosedStatus;
//# sourceMappingURL=log-statuses.js.map