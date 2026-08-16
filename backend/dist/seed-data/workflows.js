"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_WORKFLOW_ITEMS = exports.DEFAULT_WORKFLOWS = void 0;
exports.DEFAULT_WORKFLOWS = [
    { id: 'W-1001', name: 'New Client Onboarding', description: 'Standard intake-to-kickoff process for new design + build clients.', status: 'Active', owner: 'Sara R.', createdAt: '2026-06-01' },
    { id: 'W-1002', name: 'Permit & Approvals', description: 'City/county submission and approval tracking.', status: 'Draft', owner: 'Noah K.', createdAt: '2026-07-12' },
];
exports.DEFAULT_WORKFLOW_ITEMS = [
    { id: 'WI-1', workflowId: 'W-1001', title: 'Send welcome packet', status: 'Done', notes: 'Includes contract + schedule overview.', order: 0, createdAt: '2026-06-01' },
    { id: 'WI-2', workflowId: 'W-1001', title: 'Collect site details', status: 'In Progress', notes: '', order: 1, createdAt: '2026-06-02' },
    { id: 'WI-3', workflowId: 'W-1001', title: 'Schedule kickoff meeting', status: 'Open', notes: '', order: 2, createdAt: '2026-06-03' },
    { id: 'WI-4', workflowId: 'W-1002', title: 'Prepare submission set', status: 'Open', notes: '', order: 0, createdAt: '2026-07-12' },
];
//# sourceMappingURL=workflows.js.map