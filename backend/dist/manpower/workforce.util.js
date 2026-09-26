"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOpen = exports.isDeployable = exports.lifecycleStatus = exports.LEFT_STATUSES = exports.newId = exports.todayISO = void 0;
exports.nextWorkerId = nextWorkerId;
const todayISO = () => new Date().toISOString().slice(0, 10);
exports.todayISO = todayISO;
const newId = (prefix) => prefix + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
exports.newId = newId;
exports.LEFT_STATUSES = ['resigned', 'terminated', 'contract_expired', 'demobilized'];
const lifecycleStatus = (e) => e.employmentStatus || (e.status === 'inactive' ? 'resigned' : 'active');
exports.lifecycleStatus = lifecycleStatus;
const isDeployable = (e) => (0, exports.lifecycleStatus)(e) === 'active';
exports.isDeployable = isDeployable;
const isOpen = (a, on = (0, exports.todayISO)()) => a.status === 'active' && (!a.endDate || a.endDate >= on);
exports.isOpen = isOpen;
function nextWorkerId(existing, startDate) {
    const max = existing.reduce((m, id) => {
        const match = /^W-(?:\d{4}-)?(\d+)$/.exec(id || '');
        return match ? Math.max(m, Number(match[1])) : m;
    }, 0);
    const year = /^\d{4}/.test(startDate || '') ? String(startDate).slice(0, 4) : String(new Date().getFullYear());
    return `W-${year}-${String(max + 1).padStart(4, '0')}`;
}
//# sourceMappingURL=workforce.util.js.map