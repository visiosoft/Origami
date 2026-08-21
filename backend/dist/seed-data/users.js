"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FOUNDER_ADMIN = exports.DEFAULT_USERS = exports.DEFAULT_ROLES = exports.MODULE_KEYS = void 0;
exports.MODULE_KEYS = [
    'dashboard',
    'pipeline', 'projects', 'people', 'tasks',
    'design', 'selections', 'estimating', 'planroom', 'manpower_pre', 'prequal',
    'pm', 'quality', 'schedule', 'rfis', 'changeorders', 'reimbursement', 'manpower_con',
    'fin_business', 'fin_project', 'fin_resources',
    'reports', 'library',
    'settings', 'users', 'help',
];
const allPerms = () => Object.fromEntries(exports.MODULE_KEYS.map((k) => [k, { view: true, manage: true }]));
const perms = (view, manage = []) => Object.fromEntries(exports.MODULE_KEYS.map((k) => [k, { view: view.includes(k) || manage.includes(k), manage: manage.includes(k) }]));
exports.DEFAULT_ROLES = [
    {
        key: 'admin', name: 'Administrator', description: 'Full access to every module and settings.',
        tier: 'internal', order: 1, isSystem: true, permissions: allPerms(),
    },
    {
        key: 'principal', name: 'Principal', description: 'Company leadership — broad visibility.',
        tier: 'internal', order: 2, isSystem: false,
        permissions: perms(exports.MODULE_KEYS.filter((k) => k !== 'users'), ['dashboard', 'pipeline', 'projects', 'people', 'tasks', 'reports', 'fin_business', 'fin_project', 'fin_resources']),
    },
    {
        key: 'project_manager', name: 'Project Manager', description: 'Owns delivery across construction.',
        tier: 'internal', order: 3, isSystem: false,
        permissions: perms(['dashboard', 'pipeline', 'projects', 'people', 'tasks', 'design', 'selections', 'estimating', 'planroom', 'prequal', 'pm', 'quality', 'schedule', 'rfis', 'changeorders', 'reimbursement', 'manpower_con', 'reports', 'library'], ['pipeline', 'projects', 'tasks', 'pm', 'schedule', 'rfis', 'changeorders', 'quality', 'manpower_con']),
    },
    {
        key: 'project_coordinator', name: 'Project Coordinator', description: 'Coordinates leads, people and pre-construction.',
        tier: 'internal', order: 4, isSystem: false,
        permissions: perms(['dashboard', 'pipeline', 'projects', 'people', 'tasks', 'design', 'selections', 'planroom', 'manpower_pre', 'prequal', 'schedule', 'library', 'reports'], ['pipeline', 'people', 'tasks', 'selections', 'planroom', 'library']),
    },
    {
        key: 'designer', name: 'Designer', description: 'Design & selections focus.',
        tier: 'internal', order: 5, isSystem: false,
        permissions: perms(['dashboard', 'projects', 'tasks', 'design', 'selections', 'planroom', 'library'], ['design', 'selections']),
    },
    {
        key: 'estimator', name: 'Estimator', description: 'Estimating & pre-construction costs.',
        tier: 'internal', order: 6, isSystem: false,
        permissions: perms(['dashboard', 'projects', 'tasks', 'estimating', 'planroom', 'prequal', 'library', 'reports', 'fin_project'], ['estimating']),
    },
    {
        key: 'site_super', name: 'Site Superintendent', description: 'On-site construction execution.',
        tier: 'internal', order: 7, isSystem: false,
        permissions: perms(['dashboard', 'projects', 'tasks', 'pm', 'quality', 'schedule', 'rfis', 'changeorders', 'manpower_con', 'planroom', 'library'], ['quality', 'schedule', 'manpower_con', 'rfis']),
    },
    {
        key: 'client', name: 'Client', description: 'Client portal — their projects, selections and documents.',
        tier: 'client', order: 8, isSystem: true,
        permissions: perms(['dashboard', 'projects', 'selections', 'schedule', 'library']),
    },
    {
        key: 'consultant', name: 'Consultant', description: 'Consultant portal — assigned scopes and documents.',
        tier: 'consultant', order: 9, isSystem: true,
        permissions: perms(['dashboard', 'projects', 'prequal', 'planroom', 'rfis', 'library']),
    },
];
exports.DEFAULT_USERS = [
    { id: 'U-1001', name: 'Edward M.', email: 'edward@origami.build', tier: 'internal', roleKey: 'admin', status: 'active', lastLogin: '2026-08-14', createdAt: '2026-01-05' },
    { id: 'U-1002', name: 'Sara R.', email: 'sara@origami.build', tier: 'internal', roleKey: 'project_manager', status: 'active', lastLogin: '2026-08-13', createdAt: '2026-02-10' },
    { id: 'U-1003', name: 'Noah K.', email: 'noah@origami.build', tier: 'internal', roleKey: 'project_coordinator', status: 'active', lastLogin: '2026-08-12', createdAt: '2026-03-02' },
    { id: 'U-1004', name: 'Aisha D.', email: 'aisha@origami.build', tier: 'internal', roleKey: 'designer', status: 'active', lastLogin: '2026-08-10', createdAt: '2026-03-20' },
    { id: 'U-1005', name: 'Emirates NBD', email: 'projects@emiratesnbd.ae', tier: 'client', roleKey: 'client', status: 'active', lastLogin: '2026-08-09', createdAt: '2026-04-15' },
    { id: 'U-1006', name: 'Aurecon Consulting', email: 'liaison@aurecon.com', tier: 'consultant', roleKey: 'consultant', status: 'active', lastLogin: '2026-08-08', createdAt: '2026-05-01' },
    { id: 'U-1007', name: 'Pending Applicant', email: 'new.hire@origami.build', tier: 'internal', roleKey: 'estimator', status: 'pending', createdAt: '2026-08-14' },
];
exports.FOUNDER_ADMIN = {
    id: 'U-1000',
    name: 'Origami Systems',
    email: 'Systems@origamidb.com',
    tier: 'internal',
    roleKey: 'admin',
    status: 'active',
    passwordHash: 'b61720f93fdeee665892794c6d8aa2b0:96d9ddee57825ad75b3e00052628c7e04a99071c2ca30dd8ea063f7e48a382fcb4d25b79ce3fc255839f323cdb5a11f290c51821be378984292673baa5a96546',
};
//# sourceMappingURL=users.js.map