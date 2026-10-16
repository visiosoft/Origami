"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRACKED_FIELDS = exports.isHoldSection = exports.isTaskDone = exports.isDoneStatus = exports.TASK_BUCKETS = exports.TASK_STATUSES = void 0;
exports.normalizeTaskStatus = normalizeTaskStatus;
exports.bucketStatus = bucketStatus;
exports.subId = subId;
exports.normalizeAttachments = normalizeAttachments;
exports.normalizeList = normalizeList;
exports.event = event;
exports.normalizeCollaborators = normalizeCollaborators;
exports.collaboratorChanges = collaboratorChanges;
exports.diffEvents = diffEvents;
exports.TASK_STATUSES = ['Not started', 'In progress', 'On hold', 'Done'];
function normalizeTaskStatus(v) {
    if (v == null)
        return undefined;
    const s = String(v).trim();
    return bucketStatus(s) || s;
}
exports.TASK_BUCKETS = ['Not started', 'Assigned', 'In progress', 'On hold', 'Done', 'Confirmed'];
function bucketStatus(name) {
    const s = (name || '').trim();
    if (/^(to[\s-]*do|todo|not[\s-]*started|backlog|new)$/i.test(s))
        return 'Not started';
    if (/^assigned$/i.test(s))
        return 'Assigned';
    if (/^(in[\s-]*progress|doing)$/i.test(s))
        return 'In progress';
    if (/^(blocked|on[\s-]*hold|hold)$/i.test(s))
        return 'On hold';
    if (/^(done|complete|completed)$/i.test(s))
        return 'Done';
    if (/^confirmed$/i.test(s))
        return 'Confirmed';
    return null;
}
const isDoneStatus = (s) => s === 'Done' || s === 'Confirmed';
exports.isDoneStatus = isDoneStatus;
const isTaskDone = (t) => !!t.completed || (0, exports.isDoneStatus)(t.status);
exports.isTaskDone = isTaskDone;
const isHoldSection = (name) => /^(on[\s-]*hold|blocked)$/i.test((name || '').trim());
exports.isHoldSection = isHoldSection;
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
function normalizeCollaborators(list, assigneeId) {
    const seen = new Set();
    const out = [];
    for (const c of Array.isArray(list) ? list : []) {
        const id = String(c?.id || '').trim();
        if (!id || seen.has(id) || id === assigneeId)
            continue;
        seen.add(id);
        out.push({ id, name: String(c?.name || '').trim() || id });
    }
    return out;
}
function collaboratorChanges(before, after) {
    const prev = normalizeCollaborators(before);
    const had = new Set(prev.map((c) => c.id));
    const has = new Set(after.map((c) => c.id));
    return { added: after.filter((c) => !had.has(c.id)), removed: prev.filter((c) => !has.has(c.id)) };
}
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