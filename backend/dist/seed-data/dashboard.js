"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.money = exports.HELP_CONTENT = exports.ACTIVITY = exports.DEADLINES = exports.TEAM = exports.FUNNEL = exports.REVENUE_BASE = exports.INVOICES = exports.FINANCE = void 0;
exports.enrichInvoices = enrichInvoices;
exports.FINANCE = [
    { name: '1390 California', exec: 'B', contract: 'T&M', labor: 'PW', phase: 'Construction', base: 850000, co: 118000, reimb: 42000, baseUsed: 612000, coUsed: 74000, reimbUsed: 19000, timePct: 71 },
    { name: 'Noe Valley', exec: 'DB', contract: 'LS', labor: 'CP', phase: 'Design', base: 420000, co: 26000, reimb: 12000, baseUsed: 168000, coUsed: 6000, reimbUsed: 4000, timePct: 33 },
    { name: 'Cole Valley', exec: 'DBB', contract: 'T&M NTE', labor: 'PW', phase: 'Design', base: 1200000, co: 0, reimb: 55000, baseUsed: 240000, coUsed: 0, reimbUsed: 11000, timePct: 24 },
    { name: 'Hayes Valley', exec: 'D', contract: 'LS', labor: 'CP', phase: 'Design', base: 380000, co: 48000, reimb: 9000, baseUsed: 361000, coUsed: 31000, reimbUsed: 8000, timePct: 88 },
    { name: 'Pacific Heights', exec: 'DB', contract: 'CS', labor: 'CP', phase: 'Design', base: 950000, co: 0, reimb: 20000, baseUsed: 47500, coUsed: 0, reimbUsed: 2000, timePct: 9 },
    { name: 'Marina Duplex', exec: 'B', contract: 'LS', labor: 'PW', phase: 'Leads', base: 680000, co: 0, reimb: 15000, baseUsed: 0, coUsed: 0, reimbUsed: 0, timePct: 0 },
    { name: 'Perez Cottage', exec: 'DB', contract: 'T&M NTE', labor: 'CP', phase: 'Construction', base: 520000, co: 64000, reimb: 18000, baseUsed: 292000, coUsed: 22000, reimbUsed: 9000, timePct: 54 },
];
const CONTRACT_TERMS = {
    '1390 California': { net: 30, ret: 0.1, billing: 'Monthly progress · AIA G702', release: 'Retention released at substantial completion' },
    'Noe Valley': { net: 15, ret: 0, billing: 'Phase milestone', release: '—' },
    'Cole Valley': { net: 45, ret: 0.05, billing: 'Monthly progress', release: 'Retention released at CD issue' },
    'Hayes Valley': { net: 30, ret: 0.1, billing: 'Monthly progress', release: 'Retention released at final inspection' },
    'Pacific Heights': { net: 30, ret: 0, billing: 'Monthly progress', release: '—' },
    'Marina Duplex': { net: 30, ret: 0.05, billing: 'Phase milestone', release: 'Retention released at closeout' },
    'Perez Cottage': { net: 15, ret: 0, billing: 'Hourly, billed monthly', release: '—' },
    'Jayaraman ADU': { net: 15, ret: 0, billing: 'Hourly, billed monthly', release: '—' },
};
exports.INVOICES = {
    internal: [
        { id: 'INV-2601', project: '1390 California', month: 'Feb', issued: '2026-02-05', amount: 46000, paid: 46000 },
        { id: 'INV-2602', project: 'Noe Valley', month: 'Feb', issued: '2026-02-09', amount: 22000, paid: 22000 },
        { id: 'INV-2603', project: 'Hayes Valley', month: 'Feb', issued: '2026-02-20', amount: 14000, paid: 10000 },
        { id: 'INV-2611', project: '1390 California', month: 'Mar', issued: '2026-03-05', amount: 58000, paid: 58000 },
        { id: 'INV-2612', project: 'Cole Valley', month: 'Mar', issued: '2026-03-11', amount: 37000, paid: 30000 },
        { id: 'INV-2613', project: 'Pacific Heights', month: 'Mar', issued: '2026-03-18', amount: 18000, paid: 14000 },
        { id: 'INV-2614', project: 'Noe Valley', month: 'Mar', issued: '2026-03-25', amount: 12000, paid: 8000 },
        { id: 'INV-2621', project: '1390 California', month: 'Apr', issued: '2026-04-06', amount: 52000, paid: 52000 },
        { id: 'INV-2622', project: 'Hayes Valley', month: 'Apr', issued: '2026-04-14', amount: 26000, paid: 26000 },
        { id: 'INV-2623', project: 'Marina Duplex', month: 'Apr', issued: '2026-04-22', amount: 16000, paid: 16000 },
        { id: 'INV-2631', project: '1390 California', month: 'May', issued: '2026-05-05', amount: 71000, paid: 71000 },
        { id: 'INV-2632', project: 'Cole Valley', month: 'May', issued: '2026-05-12', amount: 43000, paid: 39000 },
        { id: 'INV-2633', project: 'Pacific Heights', month: 'May', issued: '2026-05-19', amount: 24000, paid: 22000 },
        { id: 'INV-2634', project: 'Perez Cottage', month: 'May', issued: '2026-05-27', amount: 18000, paid: 10000 },
        { id: 'INV-2641', project: '1390 California', month: 'Jun', issued: '2026-06-04', amount: 62000, paid: 55000 },
        { id: 'INV-2642', project: 'Noe Valley', month: 'Jun', issued: '2026-06-10', amount: 28000, paid: 24000 },
        { id: 'INV-2643', project: 'Hayes Valley', month: 'Jun', issued: '2026-06-17', amount: 19000, paid: 19000 },
        { id: 'INV-2644', project: 'Marina Duplex', month: 'Jun', issued: '2026-06-24', amount: 9000, paid: 0 },
        { id: 'INV-2651', project: '1390 California', month: 'Jul', issued: '2026-07-06', amount: 68000, paid: 40000 },
        { id: 'INV-2652', project: 'Cole Valley', month: 'Jul', issued: '2026-07-09', amount: 39000, paid: 22000 },
        { id: 'INV-2653', project: 'Pacific Heights', month: 'Jul', issued: '2026-07-20', amount: 21000, paid: 0 },
        { id: 'INV-2654', project: 'Jayaraman ADU', month: 'Jul', issued: '2026-07-27', amount: 17000, paid: 0 },
    ],
    client: [
        { id: 'INV-2612', project: '1390 California', month: 'Mar', issued: '2026-03-05', amount: 20400, paid: 20400 },
        { id: 'INV-2632', project: '1390 California', month: 'May', issued: '2026-05-05', amount: 20400, paid: 20400 },
        { id: 'INV-2651', project: '1390 California', month: 'Jul', issued: '2026-07-06', amount: 20400, paid: 20400 },
        { id: 'INV-2661', project: '1390 California', month: 'Aug', issued: '2026-07-29', amount: 20400, paid: 0 },
    ],
    consultant: [
        { id: 'BV-1181', project: '1390 California', month: 'Feb', issued: '2026-02-08', amount: 24000, paid: 24000 },
        { id: 'BV-1194', project: 'Cole Valley', month: 'Mar', issued: '2026-03-09', amount: 31000, paid: 31000 },
        { id: 'BV-1207', project: 'Hayes Valley', month: 'Apr', issued: '2026-04-10', amount: 28000, paid: 28000 },
        { id: 'BV-1219', project: '1390 California', month: 'May', issued: '2026-05-08', amount: 34000, paid: 22000 },
        { id: 'BV-1230', project: 'Cole Valley', month: 'Jun', issued: '2026-06-09', amount: 29000, paid: 21000 },
        { id: 'BV-1244', project: '1390 California', month: 'Jul', issued: '2026-07-10', amount: 40000, paid: 19000 },
    ],
};
function enrichInvoices(list) {
    const today = new Date('2026-07-31T00:00:00');
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return list.map((inv) => {
        const t = CONTRACT_TERMS[inv.project] || { net: 30, ret: 0, billing: 'Monthly progress', release: '—' };
        const issued = new Date(inv.issued + 'T00:00:00');
        const due = new Date(issued.getTime() + t.net * 86400000);
        const unpaid = inv.amount - inv.paid;
        const retFull = Math.round(inv.amount * t.ret);
        const retHeld = Math.min(unpaid, retFull);
        const receivable = unpaid - retHeld;
        const daysLate = Math.round((today.getTime() - due.getTime()) / 86400000);
        const pastDue = daysLate > 0 ? receivable : 0;
        const withinTerms = daysLate > 0 ? 0 : receivable;
        return {
            ...inv,
            net: t.net,
            retPct: t.ret,
            billing: t.billing,
            release: t.release,
            issuedLabel: fmt(issued),
            dueLabel: fmt(due),
            daysLate,
            unpaid,
            retHeld,
            receivable,
            pastDue,
            withinTerms,
            status: unpaid === 0 ? 'Paid' : pastDue > 0 ? 'Past due' : retHeld === unpaid ? 'Retention' : 'Within terms',
        };
    });
}
exports.REVENUE_BASE = {
    client: [{ month: 'Mar' }, { month: 'Apr' }, { month: 'May' }, { month: 'Jun' }, { month: 'Jul' }, { month: 'Aug' }],
    consultant: [{ month: 'Feb' }, { month: 'Mar' }, { month: 'Apr' }, { month: 'May' }, { month: 'Jun' }, { month: 'Jul' }],
    internal: [{ month: 'Feb' }, { month: 'Mar' }, { month: 'Apr' }, { month: 'May' }, { month: 'Jun' }, { month: 'Jul' }],
};
exports.FUNNEL = {
    client: [
        { label: 'Programming', n: 'Complete', v: 100 },
        { label: 'Schematic Design', n: 'Complete', v: 100 },
        { label: 'Design Development', n: 'Complete', v: 100 },
        { label: 'Construction Docs', n: 'In progress', v: 62 },
        { label: 'Interior Design', n: 'Not started', v: 0 },
        { label: 'Construction', n: 'Not started', v: 0 },
    ],
    consultant: [
        { label: 'Invitations received', n: '12', v: 100 },
        { label: 'Prequalified', n: '9', v: 75 },
        { label: 'Bids submitted', n: '6', v: 50 },
        { label: 'Shortlisted', n: '4', v: 33 },
        { label: 'Awarded', n: '3', v: 25 },
    ],
    internal: [
        { label: 'Inbound leads', n: '24', v: 100 },
        { label: 'Qualified (50+ score)', n: '16', v: 67 },
        { label: 'Face to face held', n: '11', v: 46 },
        { label: 'Proposal sent', n: '7', v: 29 },
        { label: 'Client approval', n: '4', v: 17 },
        { label: 'Contract signed', n: '3', v: 13 },
    ],
};
exports.TEAM = [
    { name: 'Edward M.', role: 'Lead Architect', kind: 'Staff', tasks: 14, done: 9, av: 'EM' },
    { name: 'Alejandra P.', role: 'Coordinator', kind: 'Staff', tasks: 8, done: 5, av: 'AP' },
    { name: 'Langston B.', role: 'Designer', kind: 'Staff', tasks: 6, done: 2, av: 'LB' },
    { name: 'Bayview Structural', role: 'Structural Eng.', kind: 'Consultant', tasks: 7, done: 4, av: 'BS' },
    { name: 'Delta MEP', role: 'MEP Consultant', kind: 'Consultant', tasks: 5, done: 1, av: 'DM' },
    { name: 'Ortiz Framing', role: 'Framing Sub', kind: 'Sub', tasks: 9, done: 6, av: 'OF' },
    { name: 'Manju R.', role: 'Owner Rep', kind: 'Owner', tasks: 3, done: 3, av: 'MR' },
];
exports.DEADLINES = [
    { task: 'AEC Team Coordination pack', project: '1390 California', due: '5 days ago', domain: 'tasks', owner: 'Edward M.', past: true },
    { task: 'Structural calcs for CO-004', project: 'Hayes Valley', due: '2 days ago', domain: 'money', owner: 'Bayview Structural', past: true },
    { task: 'Building permit resubmission', project: '1390 California', due: 'In 2 days', domain: 'projects', owner: 'Alejandra P.', past: false },
    { task: 'Tile & fixture selections due', project: 'Noe Valley', due: 'In 4 days', domain: 'projects', owner: 'Client', past: false },
    { task: 'Sub bid levelling — framing', project: 'Cole Valley', due: 'In 5 days', domain: 'leads', owner: 'Langston B.', past: false },
    { task: 'Progress billing #7', project: '1390 California', due: 'In 6 days', domain: 'money', owner: 'Manju R.', past: false },
];
exports.ACTIVITY = [
    { who: 'Manju R.', av: 'MR', act: 'approved change order CO-004', target: 'Hayes Valley · +$48,000', when: '25 min ago', domain: 'money', c: '#D2822E' },
    { who: 'Sara R.', av: 'SR', act: 'moved a lead to Proposal Sent', target: 'JBR Restaurant Fit-out · $620K', when: '1 hr ago', domain: 'leads', c: '#245C3A' },
    { who: 'Bayview Structural', av: 'BS', act: 'answered RFI-018', target: '1390 California · no cost impact', when: '3 hrs ago', domain: 'tasks', c: '#2F6F68' },
    { who: 'Alejandra P.', av: 'AP', act: 'uploaded Drawing Set Rev C', target: 'Noe Valley · 42 sheets', when: '5 hrs ago', domain: 'projects', c: '#173326' },
    { who: 'System', av: 'OG', act: 'flagged an insurance expiry', target: 'Ortiz Framing · expires in 14 days', when: 'Yesterday', domain: 'projects', c: '#B8410F' },
    { who: 'Edward M.', av: 'EM', act: 'closed 4 punch list items', target: '1390 California · Level 2', when: 'Yesterday', domain: 'tasks', c: '#173326' },
    { who: 'Origami', av: 'OG', act: 'signed a new Design-Build contract', target: 'Perez Cottage · $520,000', when: '2 days ago', domain: 'projects', c: '#2F7D4A' },
];
exports.HELP_CONTENT = {
    projects: {
        title: 'What counts as active?',
        body: 'A project with a signed contract that has had recorded activity in the last 30 days. It leaves the count 30 days after the last entry, and on closeout.',
        rows: [['1', 'new DB contract signed'], ['5', 'in Design'], ['1', 'in Construction'], ['1', 'no longer active (30 days)']],
    },
    money: {
        title: 'What is inside this number?',
        body: 'Original contract value plus approved change orders plus reimbursable allowances, for active projects only — and only the execution types selected below.',
        rows: [['IN', 'Original contract + approved COs'], ['IN', 'Reimbursable allowances'], ['OUT', 'Leads and unsigned proposals'], ['OUT', 'Closed & archived projects'], ['OUT', 'Pending COs awaiting approval']],
    },
};
const money = (n) => n >= 1000000 ? '$' + (n / 1000000).toFixed(2) + 'M' : n >= 1000 ? '$' + Math.round(n / 1000) + 'K' : '$' + n;
exports.money = money;
//# sourceMappingURL=dashboard.js.map