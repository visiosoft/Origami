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
            t('sd-site-survey', 'Site Survey', 'Project Manager'),
            t('sd-field-study', 'Field Study & As-Built Drawings', 'Project Manager'),
            t('sd-gc-list', 'GC - List of Potential Builders', 'Project Manager'),
            t('sd-planning-app', 'Municipality: Planning Application, Submittal Requirements and Process', 'Project Manager'),
            t('sd-design-1', 'Schematic Design #1', 'Architect'),
            t('sd-review-1', 'Client Review Meeting #1', 'Client'),
            t('sd-design-2', 'Schematic Design #2', 'Architect'),
            t('sd-review-2', 'Client Review Meeting #2', 'Client'),
            t('sd-renderings', 'Perspective and Renderings (Extra Service)', 'Drafting', ['Deliverable']),
            t('sd-design-3', 'Schematic Design #3', 'Architect'),
            t('sd-review-3', 'Client Review Meeting #3', 'Client'),
            t('sd-design-4', 'Schematic Design #4', 'Architect'),
            t('sd-review-4', 'Client Review Meeting #4', 'Client'),
            t('sd-client-approval', 'Schematic Design - Client Approval', 'Client', ['Approval']),
            t('sd-payment-2', 'Finance Payment #2 - Schematic Design', 'Accounting'),
            t('sd-budget-update', 'Project Budget and Milestone Schedule Update', 'Estimator', ['Deliverable']),
            t('sd-project-update', 'Project Update', 'Project Manager', ['Deliverable']),
            t('sd-design-review-app', 'Municipal Planning Design Review Application', 'Project Manager', ['Deliverable']),
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
        key: 'ccd',
        name: 'Construction Contract Documents & Building Permit',
        color: '#A03A1F',
        tasks: [
            t('ccd-permit-review', 'Municipality: review building permit application, requirements and process', 'Admin'),
            t('ccd-cd-75', 'CD Drawing Package 75% (building permit code review)', 'Architect'),
            t('ccd-permit-app', 'Municipality: Building Permit Application and Process', 'Admin'),
            t('ccd-aec-coordination', 'AEC Team: Coordination', 'Architect'),
            t('ccd-cd-90', 'CD Design Package 90% (building permit submittal package)', 'Architect'),
            t('ccd-permit-submittal', 'Municipality: Building Permit Submittal', 'Admin'),
            t('ccd-cd-95', 'CD Drawing Package 95% - Detail Floor Plans, Interior Schedules and Elevations', 'Architect'),
            t('ccd-plan-check', 'Municipality: Plan check comments', 'Permits & Compliance'),
            t('ccd-cd-100', 'CD Design Package 100%', 'Architect'),
            t('ccd-client-approval', 'Client Approval', 'Client', ['Approval']),
            t('ccd-permit-resubmittal', 'Municipality: Building Permit Resubmittal', 'Admin'),
            t('ccd-permit-approval', 'Municipality: Building Permit Approval', 'Permits & Compliance', ['Milestone']),
            t('ccd-invoice', 'Invoice - Building Permit Submittal', 'Accounting'),
        ],
    },
    {
        key: 'interior',
        name: 'Interior Design',
        color: '#B0356F',
        tasks: [
            t('id-narrative', 'Interior Narrative and Inspiration Boards', 'Interior Design', ['Deliverable']),
            t('id-conceptual', 'Interior Conceptual Designs (FF&E)', 'Interior Design'),
            t('id-schematic', 'Interior Schematic Design', 'Interior Design'),
            t('id-ffe-schedules', 'Interior FF&E Schedules', 'Interior Design', ['Deliverable']),
            t('id-construction-details', 'Interior Construction Details', 'Interior Design'),
            t('id-procurement', 'Procurement Schedules', 'Interior Design', ['Deliverable']),
        ],
    },
    {
        key: 'ca',
        name: 'Construction Administration',
        color: '#1F5FA0',
        tasks: [
            t('ca-kickoff', 'Construction kick off meeting', 'Architect'),
            t('ca-rfi', 'Request for Information/Clarifications', 'Project Manager'),
            t('ca-change-orders', 'Change Orders/Clarification', 'Architect'),
            t('ca-shop-drawings', 'Shop Drawing review', 'Architect'),
            t('ca-site-inspections', 'Periodic Site Inspections', 'Architect'),
            t('ca-punchlist', 'Punchlist & Substantial Completion', 'Architect', ['Milestone']),
        ],
    },
    {
        key: 'gc',
        name: 'General Contractor Selection',
        color: '#8A6A0E',
        tasks: [
            t('gc-preliminary-list', 'Preliminary list of potential builders', 'Project Manager'),
            t('gc-review-references', 'Review GC list and references', 'Project Manager'),
            t('gc-bid-interest', 'Bid Interest released to list of potential builders', 'Project Manager'),
            t('gc-bidding', 'Bidding and Negotiations', 'Project Manager'),
            t('gc-selection', 'GC Selection', 'Project Manager', ['Milestone']),
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