"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRestrictedViewer = isRestrictedViewer;
exports.assignedTo = assignedTo;
exports.scopeTasks = scopeTasks;
const common_1 = require("@nestjs/common");
const RESTRICTED_TIERS = ['client', 'consultant'];
function isRestrictedViewer(claims) {
    if (claims.roleKey === 'admin')
        return false;
    return RESTRICTED_TIERS.includes(claims.tier);
}
const norm = (s) => String(s ?? '').trim().toLowerCase();
function assignedTo(task, claims) {
    const id = task.assigneeId ?? task.assignedToId;
    if (id)
        return id === claims.sub;
    const name = task.assignee ?? task.assignedTo;
    return !!name && norm(name) === norm(claims.name);
}
function scopeTasks(tasks, claims) {
    if (!claims)
        throw new common_1.UnauthorizedException('Sign in to view tasks.');
    if (!isRestrictedViewer(claims))
        return tasks;
    return tasks.filter((t) => assignedTo(t, claims));
}
//# sourceMappingURL=viewer.util.js.map