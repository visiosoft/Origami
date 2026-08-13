"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initials = exports.PEOPLE = exports.COMPANY_META = exports.KIND_C = exports.TIER_STYLE = exports.KIND_STYLE = void 0;
exports.KIND_STYLE = {
    Staff: { bg: '#DCE7DE', c: '#173326' },
    Client: { bg: '#D6E8E5', c: '#2F6F68' },
    Consultant: { bg: '#E8DDF2', c: '#6B2FA0' },
    Sub: { bg: '#FBE9AE', c: '#93520F' },
    Authority: { bg: '#DCE6F2', c: '#0E5A8A' },
    Vendor: { bg: '#F2DFD4', c: '#A75A3A' },
};
exports.TIER_STYLE = {
    Internal: { bg: '#173326', c: 'white' },
    Client: { bg: '#D6E8E5', c: '#2F6F68' },
    Consultant: { bg: '#EFEDE8', c: '#43514D' },
};
exports.KIND_C = {
    Staff: '#173326', Client: '#2F6F68', Consultant: '#6B2FA0', Sub: '#93520F', Authority: '#0E5A8A', Vendor: '#A75A3A',
};
exports.COMPANY_META = {
    'Origami Design + Build': { line: '(415) 555 0100', address: '2140 Bryant St, San Francisco, CA 94110', trade: 'Design + Build general contractor', billing: 'ap@origamidb.com' },
    'Narvaes Family Trust': { line: '(415) 555 0300', address: '1390 California St, San Francisco, CA 94109', trade: 'Owner — residential', billing: 'manju@narvaestrust.com' },
    'Private Client': { line: '—', address: 'Per project record', trade: 'Owner — private individual', billing: 'Per project' },
    'Bayview Structural Inc.': { line: '(415) 555 0420', address: '88 Kearny St Suite 900, San Francisco, CA 94108', trade: 'Structural engineering', billing: 'billing@bayviewstructural.com' },
    'Delta MEP Partners': { line: '(415) 555 0460', address: '1 Post St Floor 12, San Francisco, CA 94104', trade: 'Mechanical · Electrical · Plumbing design', billing: 'accounts@deltamep.com' },
    'Torres Civil Group': { line: '(831) 555 0390', address: '415 Front St, Santa Cruz, CA 95060', trade: 'Civil engineering · site work', billing: 'luis@torrescivil.com' },
    'Ortiz Framing LLC': { line: '(415) 555 0500', address: '3320 Cesar Chavez St, San Francisco, CA 94110', trade: 'Rough carpentry · framing', billing: 'ap@ortizframing.com' },
    'Kestrel Electric Co.': { line: '(415) 555 0530', address: '740 Illinois St, San Francisco, CA 94107', trade: 'Electrical', billing: 'billing@kestrelelectric.com' },
    'Coast Plumbing & Heating': { line: '(831) 555 0540', address: '210 Swift St, Santa Cruz, CA 95060', trade: 'Plumbing · hydronics', billing: 'sam@coastplumbing.com' },
    'SF Dept. of Building Inspection': { line: '(415) 555 0900', address: '49 South Van Ness Ave, San Francisco, CA 94103', trade: 'Authority having jurisdiction', billing: 'Permit fees via portal' },
    'Harborline Building Supply': { line: '(415) 555 0720', address: '1200 Illinois St, San Francisco, CA 94107', trade: 'Materials supply · Net 30', billing: 'ar@harborlinesupply.com' },
};
exports.PEOPLE = [
    { id: 1, name: 'Edward M.', role: 'Lead Architect · Principal', company: 'Origami Design + Build', kind: 'Staff', tier: 'Internal', phone: '(415) 555 0141', email: 'edward@origamidb.com', projects: ['1390 California', 'Noe Valley', 'Cole Valley'], openTasks: 14, since: 'Mar 2019', comply: null, last: 'Active now' },
    { id: 2, name: 'Alejandra P.', role: 'Project Coordinator', company: 'Origami Design + Build', kind: 'Staff', tier: 'Internal', phone: '(415) 555 0178', email: 'alejandra@origamidb.com', projects: ['1390 California', 'Noe Valley', 'Hayes Valley', 'Perez Cottage'], openTasks: 8, since: 'Jan 2021', comply: null, last: '12 min ago' },
    { id: 3, name: 'Langston B.', role: 'Designer · Interiors', company: 'Origami Design + Build', kind: 'Staff', tier: 'Internal', phone: '(415) 555 0192', email: 'langston@origamidb.com', projects: ['Cole Valley', 'Pacific Heights'], openTasks: 6, since: 'Aug 2022', comply: null, last: '2 hrs ago' },
    { id: 4, name: 'Sara R.', role: 'Business Development', company: 'Origami Design + Build', kind: 'Staff', tier: 'Internal', phone: '(415) 555 0163', email: 'sara@origamidb.com', projects: ['Marina Duplex', 'Perez Cottage'], openTasks: 5, since: 'Feb 2023', comply: null, last: '40 min ago' },
    { id: 5, name: 'Noor K.', role: 'Estimator', company: 'Origami Design + Build', kind: 'Staff', tier: 'Internal', phone: '(415) 555 0155', email: 'noor@origamidb.com', projects: ['Cole Valley', 'Marina Duplex'], openTasks: 4, since: 'Jun 2023', comply: null, last: 'Yesterday' },
    { id: 6, name: 'Manju R.', role: 'Owner Representative', company: 'Narvaes Family Trust', kind: 'Client', tier: 'Client', phone: '(415) 555 0304', email: 'manju@narvaestrust.com', projects: ['1390 California'], openTasks: 3, since: 'Mar 2024', comply: null, last: '3 hrs ago' },
    { id: 7, name: 'Diane Narvaes', role: 'Owner', company: 'Narvaes Family Trust', kind: 'Client', tier: 'Client', phone: '(415) 555 0311', email: 'diane@narvaestrust.com', projects: ['1390 California'], openTasks: 1, since: 'Mar 2024', comply: null, last: '2 days ago' },
    { id: 8, name: 'Tomas Perez', role: 'Owner', company: 'Private Client', kind: 'Client', tier: 'Client', phone: '(831) 555 0288', email: 'tperez@gmail.com', projects: ['Perez Cottage'], openTasks: 2, since: 'Nov 2025', comply: null, last: 'Yesterday' },
    { id: 9, name: 'Priya Jayaraman', role: 'Owner', company: 'Private Client', kind: 'Client', tier: 'Client', phone: '(510) 555 0117', email: 'priya.j@outlook.com', projects: ['Jayaraman ADU'], openTasks: 4, since: 'Jan 2025', comply: null, last: '5 days ago' },
    { id: 10, name: 'Bayview Structural', role: 'Structural Engineer', company: 'Bayview Structural Inc.', contact: 'Ray Ostrowski, PE', kind: 'Consultant', tier: 'Consultant', phone: '(415) 555 0421', email: 'ray@bayviewstructural.com', projects: ['1390 California', 'Cole Valley', 'Hayes Valley'], openTasks: 7, since: 'Apr 2020', comply: { label: 'Insurance', date: 'Expires Mar 2027', ok: true, extra: 'Licence PE-48219' }, last: '3 hrs ago' },
    { id: 11, name: 'Delta MEP', role: 'MEP Consultant', company: 'Delta MEP Partners', contact: 'Hana Oyelaran', kind: 'Consultant', tier: 'Consultant', phone: '(415) 555 0466', email: 'hana@deltamep.com', projects: ['1390 California', 'Noe Valley'], openTasks: 5, since: 'Sep 2022', comply: { label: 'Insurance', date: 'Expires Nov 2026', ok: true, extra: 'Licence ME-11204' }, last: 'Yesterday' },
    { id: 12, name: 'Torres Civil', role: 'Civil Engineer', company: 'Torres Civil Group', contact: 'Luis Torres, PE', kind: 'Consultant', tier: 'Consultant', phone: '(831) 555 0399', email: 'luis@torrescivil.com', projects: ['Perez Cottage', 'Cole Valley'], openTasks: 2, since: 'Feb 2024', comply: { label: 'Insurance', date: 'Expires Aug 2026', ok: false, extra: 'Renew within 30 days' }, last: '4 days ago' },
    { id: 13, name: 'Ortiz Framing', role: 'Framing Subcontractor', company: 'Ortiz Framing LLC', contact: 'Miguel Ortiz', kind: 'Sub', tier: 'Consultant', phone: '(415) 555 0510', email: 'miguel@ortizframing.com', projects: ['1390 California', 'Perez Cottage'], openTasks: 9, since: 'Jul 2021', comply: { label: 'Insurance', date: 'Expires in 14 days', ok: false, extra: 'EMR 0.87 · Licence 1042118' }, last: '6 hrs ago' },
    { id: 14, name: 'Kestrel Electric', role: 'Electrical Subcontractor', company: 'Kestrel Electric Co.', contact: 'Dana Whitfield', kind: 'Sub', tier: 'Consultant', phone: '(415) 555 0533', email: 'dana@kestrelelectric.com', projects: ['1390 California'], openTasks: 4, since: 'May 2023', comply: { label: 'Insurance', date: 'Expires Jun 2027', ok: true, extra: 'EMR 0.74 · Licence 988402' }, last: '2 days ago' },
    { id: 15, name: 'Coast Plumbing', role: 'Plumbing Subcontractor', company: 'Coast Plumbing & Heating', contact: 'Sam Guerra', kind: 'Sub', tier: 'Consultant', phone: '(831) 555 0547', email: 'sam@coastplumbing.com', projects: ['Perez Cottage', 'Hayes Valley'], openTasks: 3, since: 'Oct 2024', comply: { label: 'Insurance', date: 'Expires Jan 2027', ok: true, extra: 'EMR 0.91 · Licence 1120945' }, last: 'Last week' },
    { id: 16, name: 'Jerrod H.', role: 'Design Phase Lead', company: 'Origami Design + Build', kind: 'Staff', tier: 'Internal', phone: '(415) 555 0149', email: 'jerrod@origamidb.com', projects: ['Noe Valley', 'Cole Valley', 'Pacific Heights'], openTasks: 11, since: 'Sep 2020', comply: null, last: '25 min ago' },
    { id: 17, name: 'SF DBI — Plan Check', role: 'Building Inspector', company: 'SF Dept. of Building Inspection', contact: 'Inspector R. Chen', kind: 'Authority', tier: 'Consultant', phone: '(415) 555 0900', email: 'plancheck@sfdbi.org', projects: ['1390 California', 'Noe Valley'], openTasks: 2, since: 'Mar 2024', comply: null, last: '8 days ago' },
    { id: 18, name: 'Harborline Supply', role: 'Materials Vendor', company: 'Harborline Building Supply', contact: 'Nia Fadel', kind: 'Vendor', tier: 'Consultant', phone: '(415) 555 0722', email: 'nia@harborlinesupply.com', projects: ['1390 California', 'Perez Cottage', 'Hayes Valley'], openTasks: 1, since: 'Jan 2022', comply: { label: 'Pricing agreement', date: 'Renews Dec 2026', ok: true, extra: 'Net 30 terms' }, last: '3 days ago' },
];
const initials = (n) => n.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
exports.initials = initials;
//# sourceMappingURL=people.js.map