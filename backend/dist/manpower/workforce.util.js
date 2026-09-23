"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOpen = exports.isDeployable = exports.lifecycleStatus = exports.LEFT_STATUSES = exports.newId = exports.todayISO = void 0;
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
//# sourceMappingURL=workforce.util.js.map