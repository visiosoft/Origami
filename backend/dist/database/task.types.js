"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRACKED_FIELDS = exports.TASK_STATUSES = void 0;
exports.subId = subId;
exports.normalizeAttachments = normalizeAttachments;
exports.normalizeList = normalizeList;
exports.event = event;
exports.diffEvents = diffEvents;
exports.TASK_STATUSES = ['Not started', 'In progress', 'Blocked', 'Done'];
let counter = 0;
function subId(prefix) {
    counter = (counter + 1) % 100000;
    return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}`;
}
function normalizeAttachments(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw.map((a, i) => ({
        ...a,
        id: a?.id || `a${i}`,
        name: a?.name || 'Attachment',
        kind: a?.kind || (a?.driveId ? 'drive' : 'link'),
    }));
}
function normalizeList(raw) {
    return Array.isArray(raw) ? raw : [];
}
function event(type, by, extra = {}) {
    return {
        id: subId('e'),
        type,
        by: by.name,
        byId: by.id,
        at: new Date().toISOString(),
        ...extra,
    };
}
exports.TRACKED_FIELDS = {
    title: 'Title',
    description: 'Description',
    dueDate: 'Due date',
    priority: 'Priority',
    status: 'Status',
    sectionId: 'Section',
    assignee: 'Assignee',
    assignedTo: 'Assignee',
    resolution: 'Resolution',
    meetingDate: 'Meeting date',
    dateClosed: 'Date closed',
    topicType: 'Topic type',
    project: 'Project',
};
function diffEvents(before, patch, by) {
    const out = [];
    for (const [key, label] of Object.entries(exports.TRACKED_FIELDS)) {
        if (!(key in patch))
            continue;
        const from = before?.[key] ?? '';
        const to = patch[key] ?? '';
        if (String(from) === String(to))
            continue;
        out.push(event(key === 'status' ? 'status' : key === 'assignee' || key === 'assignedTo' ? 'assign' : 'field', by, {
            field: key,
            from: String(from),
            to: String(to),
            text: label,
        }));
    }
    return out;
}
//# sourceMappingURL=task.types.js.map