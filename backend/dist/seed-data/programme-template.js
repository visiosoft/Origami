"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEMPLATE_LABELS = exports.TEMPLATE_TEAMS = exports.DEFAULT_PROGRAMME = void 0;
exports.parseProgramme = parseProgramme;
const t = (id, title, team = '', labels = []) => ({ id, title, team, labels });
exports.DEFAULT_PROGRAMME = [
    {
        key: 'programming',
        name: 'Project Programming',
        color: '#0E5A8A',
        tasks: [
            t('pp-01', 'Phone Interview & Project Fit', 'Admin'),
            t('pp-02', 'Introduction Letter', 'Project Manager'),
            t('pp-03', 'Project Program DRAFT', 'Project Manager', ['Deliverable']),
            t('pp-04', 'Municipality: Zoning Analysis, Permit History, Review Procedure', 'Architect'),
            t('pp-05', 'AEC Team outline', 'Project Manager'),
            t('pp-06', 'Client Review - Project Program', 'Client'),
            t('pp-07', 'Site & Client Meeting', 'Architect'),
            t('pp-08', 'Schedule of Services; (fee proposal)', 'Project Manager'),
            t('pp-09', 'Finance Payment #1 - Contract Initiation', 'Client', ['Approval']),
            t('pp-10', 'Quickbooks Client creation & Invoice for Contract Initiation', 'Accounting'),
            t('pp-11', 'Conditions of the Contract', 'Admin'),
            t('pp-12', 'Finance Payment #1 Receipt', 'Accounting'),
            t('pp-13', 'Project Budget and Milestone Schedule', 'Estimator', ['Deliverable']),
            t('pp-14', 'AEC Team: RFP and Scope of Work', 'Admin'),
        ],
    },
    {
        key: 'schematic',
        name: 'Schematic Design',
        color: '#0F7C7C',
        tasks: [
            t('sd-01', 'Client Review Meeting #1', 'Client'),
            t('sd-02', 'Schematic Design #2', 'Architect'),
            t('sd-03', 'Client Review Meeting #2', 'Client'),
            t('sd-04', 'Perspective and Renderings (Extra Service)', 'Drafting', ['Deliverable']),
            t('sd-05', 'Schematic Design #3', 'Architect'),
            t('sd-06', 'Client Review Meeting #3', 'Client'),
            t('sd-07', 'Schematic Design — Client Approval', 'Project Manager', ['Approval']),
            t('sd-08', 'Finance Payment — Schematic Design', 'Accounting'),
        ],
    },
    {
        key: 'dd',
        name: 'Design Development & Plans',
        color: '#6B2FA0',
        tasks: [
            t('dd-01', 'Municipal Planning Application Package', 'Project Manager'),
            t('dd-02', 'Municipal Planning/Entitlement Submission', 'Admin'),
            t('dd-03', 'Invoice - Planning/Entitlement Application', 'Accounting'),
            t('dd-04', 'GC - Bid Interest prepared and released to GC list', 'Estimator'),
            t('dd-05', 'Design Development Drawings: RCeiling & Lighting, Electrical, Structural MEP Diagrams', 'Architect'),
            t('dd-06', 'AEC Team Contract and Schedules', 'Project Manager'),
            t('dd-07', 'Client Review & Approval', 'Client', ['Approval']),
            t('dd-08', 'Municipal Planning Resubmission — Residential', 'Admin'),
        ],
    },
    {
        key: 'closeout',
        name: 'Closeout',
        color: '#145C33',
        tasks: [
            t('co-01', 'Final Punch List', 'Architect'),
            t('co-02', 'As-Built Drawings Issued', 'Architect', ['Deliverable']),
            t('co-03', 'Warranties & Manuals Handover', 'Admin', ['Deliverable']),
            t('co-04', 'Final Inspection Sign-off', 'Admin'),
            t('co-05', 'Certificate of Occupancy', 'Admin'),
            t('co-06', 'Client Walkthrough & Acceptance', 'Project Manager', ['Approval']),
            t('co-07', 'Final Invoice & Retention Release', 'Accounting'),
        ],
    },
];
exports.TEMPLATE_TEAMS = [
    'Admin',
    'Project Manager',
    'Architect',
    'Drafting',
    'Estimator',
    'Accounting',
    'Client',
    'Permits & Compliance',
    'Automation',
    'Interior Design',
    'Construction',
];
exports.TEMPLATE_LABELS = ['Deliverable', 'Approval', 'Auto', 'Milestone'];
function parseProgramme(raw) {
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || !parsed.length)
            return null;
        const phases = parsed
            .filter((p) => p && typeof p.key === 'string' && typeof p.name === 'string')
            .map((p, i) => ({
            key: String(p.key),
            name: String(p.name),
            color: typeof p.color === 'string' && p.color ? p.color : '#173326',
            order: i,
            tasks: Array.isArray(p.tasks)
                ? p.tasks
                    .filter((task) => task && typeof task.title === 'string' && task.title.trim())
                    .map((task, j) => ({
                    id: String(task.id || `${p.key}-${j + 1}`),
                    title: String(task.title).trim(),
                    team: String(task.team || ''),
                    labels: Array.isArray(task.labels) ? task.labels.map(String) : [],
                }))
                : [],
        }));
        return phases.length ? phases : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=programme-template.js.map