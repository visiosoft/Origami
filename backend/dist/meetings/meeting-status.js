"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEETING_LOCATION_TYPES = exports.MEETING_STATUSES = void 0;
exports.normalizeMeetingStatus = normalizeMeetingStatus;
exports.isActionDone = isActionDone;
exports.settleMeetingStatus = settleMeetingStatus;
exports.MEETING_STATUSES = ['scheduled', 'occurred', 'cancelled', 'rescheduled', 'reviewed', 'complete'];
exports.MEETING_LOCATION_TYPES = ['virtual', 'call', 'text', 'in_person'];
const ALIASES = {
    held: 'occurred', happened: 'occurred', done: 'occurred',
    canceled: 'cancelled', postponed: 'rescheduled', completed: 'complete',
};
function normalizeMeetingStatus(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (exports.MEETING_STATUSES.includes(s))
        return s;
    return ALIASES[s] || 'scheduled';
}
const TASK_DONE = /^(closed|done|complete|completed|cancell?ed|archived|void)$/i;
const RFI_DONE = ['closed', 'void', 'cancelled', 'archived'];
const CO_DONE = ['approved', 'rejected', 'cancelled', 'void', 'archived'];
function isActionDone(a, closedTaskStatuses = ['Closed']) {
    const st = String(a.status || '').trim();
    if (a.kind === 'task')
        return closedTaskStatuses.includes(st) || TASK_DONE.test(st);
    if (a.kind === 'rfi')
        return RFI_DONE.includes(st.toLowerCase());
    return CO_DONE.includes(st.toLowerCase());
}
function settleMeetingStatus(raw, actions, closedTaskStatuses) {
    const status = normalizeMeetingStatus(raw);
    if ((status !== 'reviewed' && status !== 'complete') || !actions.length)
        return status;
    const allDone = actions.every((a) => isActionDone(a, closedTaskStatuses));
    return allDone ? 'complete' : 'reviewed';
}
//# sourceMappingURL=meeting-status.js.map