"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SampleDataService = exports.SAMPLE = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const manpower_access_service_1 = require("./manpower-access.service");
const payroll_setup_service_1 = require("./payroll-setup.service");
const payroll_service_1 = require("./payroll.service");
const assets_service_1 = require("./assets.service");
const subcontractor_trades_service_1 = require("./subcontractor-trades.service");
const calendar_util_1 = require("./calendar.util");
const workforce_util_1 = require("./workforce.util");
exports.SAMPLE = 'DEMO-';
const NOTE = 'Sample data for testing -- remove it from Setup › Sample Data.';
const SAMPLE_WORK = [
    ['E06', '04 00 00', 8, 'CMU block walls, level 3'], ['E07', '03 00 00', 8, 'Column formwork, grid C'],
    ['E10', '03 00 00', 8, 'Rebar placement, level 4 deck'], ['E11', '04 00 00', 8, 'Material handling for masons'],
    ['E08', '26 00 00', 8, 'Conduit in deck'], ['E09', '05 00 00', 8, 'Stair rail welding'],
    ['E13', '31 00 00', 8, 'Excavation for underground detention tank'], ['E14', '26 00 00', 8, 'Panel installs, parking structure'],
    ['E16', '03 00 00', 8, 'Rebar placement, level 4 deck'],
    ['E03', '01 00 00', 8, 'Crew supervision and daily coordination'], ['E12', '01 00 00', 8, 'Crew shuttle and material runs'],
];
const monthStart = (iso, back = 0) => { const d = new Date(iso + 'T00:00:00Z'); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1)).toISOString().slice(0, 10); };
const monthEnd = (iso, back = 0) => { const d = new Date(iso + 'T00:00:00Z'); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back + 1, 0)).toISOString().slice(0, 10); };
const monthName = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
let SampleDataService = class SampleDataService {
    constructor(employees, contractors, subTrades, projects, csi, records, assignments, requests, logs, entries, leave, leaveAdj, overtime, advances, shifts, assets, assetIssues, units, beds, complaints, routes, riders, payslips, runs, setup, access, payroll, tsSheets, tsLines) {
        this.employees = employees;
        this.contractors = contractors;
        this.subTrades = subTrades;
        this.projects = projects;
        this.csi = csi;
        this.records = records;
        this.assignments = assignments;
        this.requests = requests;
        this.logs = logs;
        this.entries = entries;
        this.leave = leave;
        this.leaveAdj = leaveAdj;
        this.overtime = overtime;
        this.advances = advances;
        this.shifts = shifts;
        this.assets = assets;
        this.assetIssues = assetIssues;
        this.units = units;
        this.beds = beds;
        this.complaints = complaints;
        this.routes = routes;
        this.riders = riders;
        this.payslips = payslips;
        this.runs = runs;
        this.setup = setup;
        this.access = access;
        this.payroll = payroll;
        this.tsSheets = tsSheets;
        this.tsLines = tsLines;
    }
    async status() {
        const [employees, contractors, payrollRuns, timesheets] = await Promise.all([
            this.employees.count({ where: { id: (0, typeorm_2.Like)(`${exports.SAMPLE}%`) } }),
            this.contractors.count({ where: { id: (0, typeorm_2.Like)(`${exports.SAMPLE}%`) } }),
            this.runs.count({ where: { id: (0, typeorm_2.Like)(`${exports.SAMPLE}%`) } }),
            this.tsSheets ? this.tsSheets.count({ where: { id: (0, typeorm_2.Like)(`${exports.SAMPLE}%`) } }) : Promise.resolve(0),
        ]);
        return { loaded: employees > 0 || contractors > 0, employees, contractors, payrollRuns, timesheets };
    }
    async load(actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'load sample data');
        if ((await this.status()).loaded)
            throw new common_1.BadRequestException('Sample data is already loaded. Remove it first to load it fresh.');
        const today = (0, workforce_util_1.todayISO)();
        const d = (n) => (0, calendar_util_1.addDays)(today, n);
        const now = new Date().toISOString();
        const id = (s) => exports.SAMPLE + s;
        const by = actor.name || 'Sample data';
        const allProjects = await this.projects.find();
        const live = allProjects.filter((p) => p.stage !== 'Kickoff');
        const [p1, p2] = (live.length ? live : allProjects).map((p) => p.id);
        const csi = new Map((await this.csi.find()).map((c) => [c.code, c.id]));
        const sub = new Map((await this.subTrades.find()).map((t) => [t.code, t.id]));
        const tradeOf = (workerTrade) => sub.get(subcontractor_trades_service_1.WORKER_TRADE_CODE[workerTrade || ''] || '');
        const { weekendDays } = await this.setup.settings();
        await this.contractors.save([
            {
                id: id('CTR1'), companyName: 'Golden State Electric, Inc.', contactPerson: 'Mark Stevens', phone: '(916) 555-0142', email: 'office@goldenstateelectric.example',
                address: '8120 Power Inn Rd, Sacramento, CA 95828', contractNumber: 'SC-2026-014', contractStart: d(-120), contractEnd: d(240),
                scopeOfWork: 'Electrical rough-in, conduit, wire pulls and panel installs for the building.', agreedRates: 'Journeyman electrician $95/hr; apprentice $62/hr (billed)',
                insuranceProvider: "Travelers (CGL & workers' comp)", insurancePolicyNumber: 'TRV-CGL-4471903', insuranceExpiry: d(25),
                tradeIds: ['C-10', 'C-7'].map((c) => sub.get(c)).filter(Boolean), licenseNumber: 'CSLB #1043871', licenseExpiry: d(300),
                status: 'active', notes: NOTE, attachments: [], createdAt: now, updatedAt: now,
            },
            {
                id: id('CTR2'), companyName: 'Sierra Rebar & Steel, LLC', contactPerson: 'Greg Holloway', phone: '(916) 555-0177', email: 'bids@sierrarebar.example',
                address: '4401 Florin Perkins Rd, Sacramento, CA 95826', contractNumber: 'SC-2026-021', contractStart: d(-60), contractEnd: d(20),
                scopeOfWork: 'Rebar detailing, fabrication and placement; structural steel erection for the podium.', agreedRates: 'Rebar placing $1,150/ton; steel erection per bid',
                insuranceProvider: 'Liberty Mutual', insurancePolicyNumber: 'LM-GL-88213-26', insuranceExpiry: d(-10),
                tradeIds: ['C-50', 'C-51', 'C-60'].map((c) => sub.get(c)).filter(Boolean), licenseNumber: 'CSLB #987234', licenseExpiry: d(15),
                status: 'active', notes: NOTE, attachments: [], createdAt: now, updatedAt: now,
            },
        ]);
        const comps = await this.setup.listComponents();
        const comp = (name) => comps.find((c) => c.name === name)?.id;
        const withholding = (fed, extra = []) => [{ componentId: comp('Federal income tax withholding'), value: fed }, { componentId: comp('State income tax'), value: fed >= 12 ? 6 : 4 },
            { componentId: comp('State disability insurance (SDI)'), value: 1.3 }, ...extra].filter((x) => x.componentId);
        const benefits = [{ componentId: comp('401(k) contribution'), value: 5 }, { componentId: comp('Health insurance premium'), value: 180 }];
        const people = [
            { k: 'E01', name: 'Michael Thompson', t: 'Engineer', designation: 'Project Engineer', department: 'Projects', grade: 'PE-2', employmentType: 'permanent', flsaStatus: 'exempt', workersCompClass: '8227', payType: 'monthly', payRate: 8750, gender: 'male', dob: '1988-04-12', hireDate: '2022-02-01', yearsExperience: 12, skillLevel: 'expert', expertise: ['Submittals', 'RFIs', 'QA/QC'], filingStatus: 'married_jointly', payComponents: withholding(12, benefits) },
            { k: 'E02', name: 'Jennifer Martinez', designation: 'HR Manager', department: 'Human Resources', grade: 'M-2', employmentType: 'permanent', flsaStatus: 'exempt', workersCompClass: '8810', payType: 'monthly', payRate: 7200, gender: 'female', dob: '1990-09-03', hireDate: '2023-05-15', filingStatus: 'head_of_household', payComponents: withholding(10, benefits) },
            { k: 'E03', name: 'Robert Johnson', t: 'Foreman', designation: 'General Foreman', department: 'Field Operations', grade: 'F-1', employmentType: 'permanent', flsaStatus: 'non_exempt', workersCompClass: '5403', payType: 'hourly', payRate: 54, gender: 'male', dob: '1979-01-20', hireDate: '2019-08-01', yearsExperience: 22, skillLevel: 'expert', filingStatus: 'married_jointly', payComponents: withholding(12, benefits) },
            { k: 'E04', name: 'David Williams', t: 'Supervisor', designation: 'Superintendent', department: 'Field Operations', grade: 'S-3', employmentType: 'permanent', flsaStatus: 'exempt', workersCompClass: '5606', payType: 'monthly', payRate: 9500, gender: 'male', dob: '1983-06-11', hireDate: '2021-03-01', yearsExperience: 18, skillLevel: 'expert', filingStatus: 'married_jointly', payComponents: withholding(14, benefits) },
            { k: 'E05', name: 'Sarah Chen', t: 'Estimator', designation: 'Estimator', department: 'Preconstruction', grade: 'E-2', employmentType: 'contract', flsaStatus: 'exempt', workersCompClass: '8810', payType: 'monthly', payRate: 7900, gender: 'female', dob: '1991-11-30', hireDate: '2024-01-10', yearsExperience: 9, skillLevel: 'skilled', filingStatus: 'single', payComponents: withholding(12) },
            { k: 'E06', name: 'Carlos Hernandez', t: 'Mason', designation: 'Mason', department: 'Field Operations', employmentType: 'daily_wage', flsaStatus: 'non_exempt', workersCompClass: '5022', payType: 'hourly', payRate: 38.5, gender: 'male', dob: '1987-03-14', hireDate: '2023-09-01', yearsExperience: 14, skillLevel: 'skilled', expertise: ['CMU block', 'Brick veneer'], filingStatus: 'married_jointly', payComponents: withholding(10) },
            { k: 'E07', name: 'James Miller', t: 'Carpenter', designation: 'Carpenter (formwork)', department: 'Field Operations', employmentType: 'daily_wage', flsaStatus: 'non_exempt', workersCompClass: '5403', payType: 'hourly', payRate: 41, gender: 'male', dob: '1991-07-22', hireDate: '2024-02-12', yearsExperience: 8, skillLevel: 'skilled', expertise: ['Concrete forming', 'Framing'], filingStatus: 'single', payComponents: withholding(10) },
            { k: 'E08', name: "Kevin O'Brien", t: 'Electrician', designation: 'Journeyman Electrician', department: 'MEP', employmentType: 'daily_wage', flsaStatus: 'non_exempt', workersCompClass: '5190', payType: 'hourly', payRate: 48, gender: 'male', dob: '1993-12-05', hireDate: '2024-06-01', yearsExperience: 7, skillLevel: 'skilled', filingStatus: 'single', payComponents: withholding(12) },
            { k: 'E09', name: 'Luis Ramirez', t: 'Welder', designation: 'Certified Welder', department: 'Field Operations', employmentType: 'daily_wage', flsaStatus: 'non_exempt', workersCompClass: '3724', payType: 'hourly', payRate: 46, gender: 'male', dob: '1986-02-18', hireDate: '2022-11-20', yearsExperience: 13, skillLevel: 'expert', expertise: ['SMAW', 'FCAW', 'GMAW'], filingStatus: 'married_jointly', payComponents: withholding(10) },
            { k: 'E10', name: 'Marcus Davis', t: 'Steel Fixer', designation: 'Rebar Ironworker', department: 'Field Operations', employmentType: 'daily_wage', flsaStatus: 'non_exempt', workersCompClass: '5225', payType: 'hourly', payRate: 44, gender: 'male', dob: '1995-05-09', hireDate: '2025-01-06', yearsExperience: 5, skillLevel: 'semi_skilled', filingStatus: 'single', payComponents: withholding(10) },
            { k: 'E11', name: 'Tyler Anderson', t: 'Laborer', designation: 'Construction Laborer', department: 'Field Operations', employmentType: 'daily_wage', flsaStatus: 'non_exempt', workersCompClass: '5403', payType: 'hourly', payRate: 28, gender: 'male', dob: '2000-10-01', hireDate: '2025-07-01', yearsExperience: 1, skillLevel: 'helper', filingStatus: 'single', payComponents: withholding(8) },
            { k: 'E12', name: 'Anthony Brown', t: 'Driver', designation: 'CDL Driver', department: 'Logistics', employmentType: 'contract', flsaStatus: 'non_exempt', workersCompClass: '7219', payType: 'hourly', payRate: 32, gender: 'male', dob: '1984-08-27', hireDate: '2023-04-01', yearsExperience: 16, skillLevel: 'skilled', equipmentCapabilities: ['Crew van', 'Pickup', 'Dump truck'], filingStatus: 'married_jointly', payComponents: withholding(10) },
            { k: 'E13', name: 'Daniel Garcia', t: 'Equipment Operator', designation: 'Excavator Operator', department: 'Equipment', employmentType: 'daily_wage', flsaStatus: 'non_exempt', workersCompClass: '6217', payType: 'hourly', payRate: 52, gender: 'male', dob: '1981-04-02', hireDate: '2021-10-11', yearsExperience: 20, skillLevel: 'expert', equipmentCapabilities: ['Excavator', 'Backhoe', 'Skid steer'], filingStatus: 'married_jointly', payComponents: withholding(12) },
            { k: 'E14', name: 'Ryan Wilson', t: 'Electrician', designation: 'Journeyman Electrician', employmentType: 'contractor_worker', contractorId: id('CTR1'), siteAccessStatus: 'granted', payType: 'hourly', payRate: 50, gender: 'male', dob: '1994-03-19', hireDate: d(-100), skillLevel: 'skilled' },
            { k: 'E15', name: 'Jose Lopez', t: 'Electrician', designation: 'Electrician Apprentice', employmentType: 'contractor_worker', contractorId: id('CTR1'), siteAccessStatus: 'pending', payType: 'hourly', payRate: 26, gender: 'male', dob: '2001-09-09', hireDate: d(-10), skillLevel: 'helper' },
            { k: 'E16', name: 'Brandon Taylor', t: 'Steel Fixer', designation: 'Rebar Ironworker', employmentType: 'contractor_worker', contractorId: id('CTR2'), siteAccessStatus: 'granted', payType: 'hourly', payRate: 45, gender: 'male', dob: '1989-12-12', hireDate: d(-55), skillLevel: 'skilled' },
            { k: 'E17', name: 'Emily Clark', t: 'Painter', designation: 'Painter', department: 'Finishes', employmentType: 'daily_wage', flsaStatus: 'non_exempt', workersCompClass: '5474', employmentStatus: 'resigned', status: 'inactive', payType: 'hourly', payRate: 34, gender: 'female', dob: '1990-01-01', hireDate: '2023-01-02', filingStatus: 'single' },
        ];
        const ssn = (i) => `666-${String(10 + i).padStart(2, '0')}-${String(4000 + i * 137).slice(-4)}`;
        const phone = (i) => `(916) 555-01${String(10 + i).padStart(2, '0')}`;
        const staff = ['E01', 'E02', 'E03', 'E04', 'E05'];
        const homes = ['2418 J St, Sacramento, CA 95816', '9120 Laguna Main St, Elk Grove, CA 95758', '1507 Pleasant Grove Blvd, Roseville, CA 95747', '410 Blue Ravine Rd, Folsom, CA 95630', '3200 Zinfandel Dr, Rancho Cordova, CA 95670', '5800 Stockton Blvd, Sacramento, CA 95824'];
        const contacts = [['Laura Thompson', 'Spouse'], ['Maria Martinez', 'Mother'], ['Susan Johnson', 'Spouse'], ['Karen Williams', 'Spouse'], ['Kevin Chen', 'Brother'], ['Ana Hernandez', 'Spouse']];
        const banks = [['Wells Fargo', '121000248'], ['Bank of America', '121000358'], ['Chase', '322271627'], ['Golden 1 Credit Union', '321175261']];
        await this.employees.save(people.map(({ k, t, ...p }, i) => ({
            id: id(k), workerId: `SMP-${String(i + 1).padStart(3, '0')}`, trade: t, tradeId: tradeOf(t), jobTitle: p.designation,
            nationalId: p.contractorId ? undefined : ssn(i + 1), phone: phone(i + 1),
            email: staff.includes(k) ? `${p.name.toLowerCase().replace(/[^a-z ]/g, '').split(' ').join('.')}@example.com` : undefined,
            emergencyContactName: contacts[i % contacts.length][0], emergencyContactRelation: contacts[i % contacts.length][1], emergencyContactPhone: phone(40 + i),
            currentAddress: p.contractorId ? undefined : homes[i % homes.length],
            bankName: p.contractorId ? undefined : banks[i % banks.length][0], bankRoutingNumber: p.contractorId ? undefined : banks[i % banks.length][1],
            bankAccount: p.contractorId ? undefined : `00${String(4821330000 + i * 7919).slice(0, 10)}`, taxState: p.contractorId ? undefined : 'CA',
            supervisorId: staff.includes(k) ? (k === 'E03' ? id('E04') : k === 'E04' || k === 'E02' ? undefined : id('E04')) : id('E03'),
            hrOfficerId: k === 'E02' ? undefined : id('E02'), payComponents: [],
            status: 'active', employmentStatus: 'active', ...p, createdAt: now, updatedAt: now,
        })));
        const rec = (k, n, r) => ({ id: id(`R${k}${n}`), employeeId: id(k), attachments: [], verification: 'verified', createdAt: now, notes: NOTE, ...r });
        await this.records.save([
            ...people.filter((p) => !p.contractorId).map((p, i) => rec(p.k, 1, { kind: 'document', type: "Driver's license", number: `D${String(5530000 + i * 4127).slice(0, 7)}`, issuer: 'California DMV', issueDate: '2022-06-01', expiryDate: p.k === 'E11' ? d(-30) : '2027-06-01' })),
            rec('E09', 3, { kind: 'document', type: 'Employment authorization (EAD)', number: 'IOE-091-555-2231', issuer: 'USCIS', issueDate: d(-680), expiryDate: d(50) }),
            rec('E01', 2, { kind: 'certification', type: 'OSHA 30', title: 'OSHA 30-Hour Construction', number: '30-0412-7781', issuer: 'OSHA Outreach Training Program', issueDate: d(-800) }),
            rec('E06', 2, { kind: 'certification', type: 'OSHA 10', title: 'OSHA 10-Hour Construction', number: '10-2291-5530', issuer: 'OSHA Outreach Training Program', issueDate: d(-400) }),
            rec('E09', 2, { kind: 'certification', type: 'Welding certification', title: 'AWS D1.1 structural steel', number: 'AWS-D11-44718', issuer: 'American Welding Society', issueDate: d(-700), expiryDate: d(20) }),
            rec('E13', 2, { kind: 'certification', type: 'Equipment operator certification', title: 'Excavator operator', number: 'NCCER-HEO-9921', issuer: 'NCCER', issueDate: d(-1100), expiryDate: d(-5) }),
            rec('E12', 2, { kind: 'certification', type: 'Commercial driver\'s license', title: 'CDL Class A', number: 'CDL-A-5512088', issuer: 'California DMV', issueDate: d(-900), expiryDate: d(900) }),
            rec('E12', 4, { kind: 'certification', type: 'DOT medical card', title: 'DOT medical examiner\'s certificate', number: 'MEC-771203', issuer: 'FMCSA certified examiner', issueDate: d(-705), expiryDate: d(25) }),
            rec('E08', 2, { kind: 'certification', type: 'Electrical certification', title: 'California General Electrician', number: 'GE-118273', issuer: 'CA DIR Electrician Certification Unit', issueDate: d(-400), expiryDate: d(330) }),
            rec('E01', 3, { kind: 'contract', type: 'permanent', title: 'Offer letter (at-will)', number: 'EMP-2022-031', issueDate: '2022-02-01', rate: 8750, status: 'active', terms: 'At-will employment; exempt salaried; PTO and benefits per handbook.' }),
            rec('E05', 2, { kind: 'contract', type: 'fixed_term', title: 'Fixed-term agreement', number: 'EMP-2024-004', issueDate: '2024-01-10', expiryDate: d(40), rate: 7900, status: 'active', terms: 'Fixed term, renewable subject to backlog.' }),
            rec('E12', 3, { kind: 'contract', type: 'project', title: 'Project agreement — driver', number: 'EMP-2023-019', issueDate: '2023-04-01', expiryDate: d(-3), rate: 32, status: 'active' }),
        ]);
        if (p1) {
            const onP1 = ['E01', 'E03', 'E04', 'E06', 'E07', 'E08', 'E09', 'E10', 'E11', 'E13', 'E14', 'E15', 'E16'];
            const onP2 = p2 ? ['E05', 'E12'] : [];
            const assign = (k, projectId, extra = {}) => ({
                id: id(`AS${k}${projectId === p1 ? 1 : 2}`), employeeId: id(k), projectId, tradeId: tradeOf(people.find((p) => p.k === k).t),
                designation: people.find((p) => p.k === k).designation, assignmentType: 'regular', startDate: d(-45), status: 'active', createdByName: by, createdAt: now, ...extra,
            });
            await this.assignments.save([
                ...onP1.map((k) => assign(k, p1, { workArea: ['E06', 'E07', 'E10', 'E11'].includes(k) ? 'Building A' : ['E08', 'E14', 'E15'].includes(k) ? 'Parking structure' : undefined })),
                ...onP2.map((k) => assign(k, p2)),
                ...(p2 ? [assign('E09', p2, { id: id('ASE09T'), assignmentType: 'temporary', startDate: d(1), endDate: d(5), workArea: 'Lot 7', notes: 'Temporary cover for stair stringer welding' })] : []),
            ]);
            await this.requests.save({
                id: id('WR1'), projectId: p2 || p1, workArea: 'Lots 1-8', requiredDate: d(7), durationDays: 30, status: 'submitted',
                lines: [
                    { id: 'L1', tradeId: sub.get('C-29') || '', designation: 'Mason', quantity: 4 },
                    { id: 'L2', tradeId: sub.get('C-33') || '', designation: 'Painter', quantity: 2 },
                    { id: 'L3', tradeId: sub.get('C-54') || '', designation: 'Tile setter', quantity: 2 },
                ],
                notes: 'CMU site walls and finishes. ' + NOTE, requestedByName: 'David Williams', submittedAt: now, createdAt: now,
            });
            const days = [];
            for (let n = 1; days.length < 6 && n < 20; n++)
                if (!weekendDays.includes((0, calendar_util_1.weekday)(d(-n))))
                    days.unshift(d(-n));
            const work = SAMPLE_WORK;
            const logRows = [];
            const entryRows = [];
            days.forEach((date, i) => {
                const last = i === days.length - 1;
                const logId = id(`DL${i + 1}`);
                logRows.push({
                    id: logId, projectId: p1, date, supervisorName: 'David Williams', notes: last ? 'Deck pour prep on level 4.' : undefined,
                    status: last ? 'submitted' : 'approved', submittedAt: `${date}T23:30:00.000Z`,
                    approvedByName: last ? undefined : 'Michael Thompson', approvedAt: last ? undefined : `${(0, calendar_util_1.addDays)(date, 1)}T16:00:00.000Z`, createdAt: `${date}T23:00:00.000Z`,
                });
                work.forEach(([k, code, hours, task], j) => {
                    if (k === 'E06' && i === 2)
                        return;
                    const h = k === 'E07' && i === days.length - 2 ? 11 : hours;
                    entryRows.push({ id: id(`LE${i + 1}-${j}`), dailyLogId: logId, employeeId: id(k), csiCodeId: csi.get(code) || csi.values().next().value, hours: h, taskDetail: task, taskStatus: i === 0 ? 'start' : last ? 'completing' : 'continued', team: j < 4 ? 'A' : 'B' });
                });
            });
            await this.logs.save(logRows);
            await this.entries.save(entryRows);
            await this.overtime.save([
                { id: id('OT1'), employeeId: id('E09'), projectId: p1, date: days[days.length - 3], hours: 2, otType: 'normal', status: 'approved', source: 'daily_log', reason: 'Stair rails had to finish before inspection', requestedByName: 'David Williams', decidedByName: 'Michael Thompson', decidedAt: now, baseRate: 46, multiplier: 1.5, amount: 138, createdAt: now },
                { id: id('OT2'), employeeId: id('E08'), projectId: p1, date: days[days.length - 1], hours: 3, otType: 'normal', status: 'pending', source: 'manual', reason: 'Conduit before the deck pour', requestedByName: 'David Williams', createdAt: now },
                { id: id('OT3'), employeeId: id('E13'), projectId: p1, date: days[days.length - 2], hours: 4, otType: 'night', status: 'pending', source: 'manual', reason: 'Dewatering the excavation overnight', requestedByName: 'Robert Johnson', createdAt: now },
            ]);
        }
        const leaveDays = (a, b) => (0, calendar_util_1.workingDays)(a, b, weekendDays, new Set()).length;
        const lr = (n, k, typeId, type, a, b, status, reason, extra = {}) => ({
            id: id(`LR${n}`), employeeId: id(k), leaveTypeId: typeId, type, startDate: a, endDate: b, halfDay: false, days: leaveDays(a, b), status, reason,
            requestedBy: 'Jennifer Martinez', requestedAt: now, decidedBy: status === 'pending' ? undefined : 'Jennifer Martinez', decidedAt: status === 'pending' ? undefined : now, ...extra,
        });
        await this.leave.save([
            lr(1, 'E06', 'LT-ANNUAL', 'Vacation (PTO)', d(8), d(10), 'approved', 'Family trip to Lake Tahoe'),
            lr(2, 'E07', 'LT-SICK', 'Sick', d(1), d(2), 'pending', "Flu — doctor's note to follow"),
            lr(3, 'E03', 'LT-ANNUAL', 'Vacation (PTO)', d(-30), d(-26), 'approved', 'Vacation'),
            lr(4, 'E05', 'LT-CASUAL', 'Personal', d(3), d(3), 'pending', 'DMV appointment', { halfDay: true, days: 0.5 }),
            lr(5, 'E11', 'LT-UNPAID', 'Unpaid', d(-12), d(-10), 'approved', 'Family matter out of state'),
            lr(6, 'E10', 'LT-JURY', 'Jury duty', d(-3), d(-3), 'approved', 'Sacramento County jury summons'),
        ]);
        const approvals = (stages) => stages.map((stage) => ({ stage, decision: 'approved', byName: stage === 'manager' ? 'David Williams' : stage === 'hr' ? 'Jennifer Martinez' : 'Finance Officer', at: now }));
        await this.advances.save([
            { id: id('ADV1'), employeeId: id('E06'), type: 'salary_advance', amount: 1500, requestDate: (0, calendar_util_1.addDays)(monthStart(today, 1), -6), reason: 'Car registration and repairs', installments: 3, installmentAmount: 500, deductionStart: monthStart(today, 1), status: 'disbursed', approvals: approvals(['manager', 'hr', 'finance']), disbursedAt: (0, calendar_util_1.addDays)(monthStart(today, 1), -3), disbursedByName: 'Finance Officer', paymentMethod: 'bank_transfer', repayments: [], recovered: 0, createdByName: 'Robert Johnson', createdAt: now },
            { id: id('ADV2'), employeeId: id('E10'), type: 'emergency_advance', amount: 800, requestDate: d(-2), reason: 'Medical bill for a family member', installments: 2, installmentAmount: 400, deductionStart: d(20), status: 'pending_hr', approvals: approvals(['manager']), repayments: [], recovered: 0, createdByName: 'Robert Johnson', createdAt: now },
            { id: id('ADV3'), employeeId: id('E01'), type: 'loan', amount: 6000, requestDate: d(-3), reason: 'Relocation costs', installments: 12, installmentAmount: 500, deductionStart: d(30), status: 'pending_finance', approvals: approvals(['manager', 'hr']), repayments: [], recovered: 0, createdByName: 'Michael Thompson', createdAt: now },
        ]);
        const shift = (n, k, templateIds, extra = {}) => ({ id: id(`SA${n}`), employeeId: id(k), templateIds, startDate: d(-14), createdByName: by, createdAt: now, ...extra });
        await this.shifts.save([
            ...['E06', 'E07', 'E10', 'E11', 'E03'].map((k, i) => shift(i + 1, k, ['SH-DAY'])),
            shift(6, 'E08', ['SH-DAY', 'SH-NIGHT'], { rotateEveryDays: 7 }),
            shift(7, 'E14', ['SH-NIGHT', 'SH-DAY'], { rotateEveryDays: 7 }),
            shift(8, 'E13', ['SH-12D']),
            shift(9, 'E09', ['SH-DAY'], { startDate: d(-60), endDate: d(-15) }),
            shift(10, 'E09', ['SH-12N'], { notes: 'Night welding while the crane is free' }),
        ]);
        const tags = (await this.assets.find()).map((a) => a.assetTag);
        const tag = () => { const t = (0, assets_service_1.nextAssetTag)(tags); tags.push(t); return t; };
        const assetRows = [
            { k: 'AS1', name: 'Dell Latitude 5450', category: 'laptop', serialNumber: 'DEMO-SVC-5450-01', condition: 'good', cost: 1450, purchaseDate: d(-400) },
            { k: 'AS2', name: 'Apple iPhone 15', category: 'mobile', serialNumber: 'DEMO-IMEI-3577-81', condition: 'good', cost: 799, purchaseDate: d(-200) },
            { k: 'AS3', name: 'Milwaukee M18 hammer drill kit', category: 'tools', serialNumber: 'DEMO-MWK-2904', condition: 'fair', cost: 429, purchaseDate: d(-500) },
            { k: 'AS4', name: 'PPE kit (hard hat, boots, hi-vis vest)', category: 'uniform', condition: 'new', cost: 180, purchaseDate: d(-30) },
            { k: 'AS5', name: 'Ford F-150 XL (CA 8ABC123)', category: 'vehicle', serialNumber: 'DEMO-VIN-1FTFW1E5', condition: 'good', cost: 42000, purchaseDate: d(-700) },
            { k: 'AS6', name: 'Verizon SIM (site line)', category: 'sim', serialNumber: 'DEMO-SIM-916-5550', condition: 'good', cost: 30, purchaseDate: d(-90) },
            { k: 'AS7', name: 'Trimble robotic total station', category: 'tools', serialNumber: 'DEMO-TRM-S7', condition: 'damaged', cost: 18500, purchaseDate: d(-900), status: 'in_repair' },
        ];
        const issued = [['AS1', 'E01', d(-300)], ['AS2', 'E04', d(-150)], ['AS3', 'E08', d(-40), d(-7)], ['AS5', 'E12', d(-200)], ['AS6', 'E03', d(-80)]];
        await this.assets.save(assetRows.map(({ k, ...a }) => ({
            status: issued.some(([x]) => x === k) ? 'issued' : 'available', ...a, id: id(k), assetTag: tag(), notes: NOTE, createdAt: now, updatedAt: now,
        })));
        await this.assetIssues.save([
            ...issued.map(([a, e, at, back], i) => ({ id: id(`AI${i + 1}`), assetId: id(a), employeeId: id(e), issuedAt: at, expectedReturn: back, status: 'open', issuedByName: 'Jennifer Martinez' })),
            { id: id('AI9'), assetId: id('AS4'), employeeId: id('E17'), issuedAt: '2023-01-02', status: 'returned', returnedAt: d(-60), returnCondition: 'fair', issuedByName: 'Jennifer Martinez', closedByName: 'Jennifer Martinez' },
        ]);
        const unit = (k, level, name, parentId) => ({ id: id(k), level, name, parentId, active: true, createdAt: now });
        const unitRows = [unit('C1', 'camp', 'Travel Crew Housing — Elk Grove'), unit('B1', 'building', 'Extended Stay Suites', id('C1')), unit('F1', 'floor', 'Floor 1', id('B1')),
            unit('RM1', 'room', 'Suite 101', id('F1')), unit('RM2', 'room', 'Suite 102', id('F1')), unit('RM3', 'room', 'Supervisor suite', id('B1'))];
        for (const [room, n] of [['RM1', 4], ['RM2', 4], ['RM3', 2]])
            for (let b = 1; b <= n; b++)
                unitRows.push(unit(`${room}B${b}`, 'bed', `Bed ${b}`, id(room)));
        await this.units.save(unitRows);
        const housed = [['E06', 'RM1B1'], ['E07', 'RM1B2'], ['E10', 'RM1B3'], ['E11', 'RM1B4'], ['E09', 'RM2B1'], ['E13', 'RM2B2'], ['E08', 'RM2B3'], ['E03', 'RM3B1']];
        await this.beds.save(housed.map(([e, b], i) => ({ id: id(`BA${i + 1}`), bedId: id(b), employeeId: id(e), checkIn: d(-45), byName: 'Jennifer Martinez' })));
        await this.complaints.save([
            { id: id('AC1'), unitId: id('RM2'), title: 'AC not cooling', description: 'Unit blows warm air in the afternoon.', employeeId: id('E08'), status: 'open', reportedByName: 'Robert Johnson', reportedAt: now },
            { id: id('AC2'), unitId: id('B1'), title: 'Bathroom exhaust fan not working', status: 'in_progress', reportedByName: 'Robert Johnson', reportedAt: new Date(Date.now() - 4 * 864e5).toISOString() },
            { id: id('AC3'), unitId: id('RM1'), title: 'Broken window latch', status: 'resolved', resolution: 'Latch replaced by property maintenance.', reportedByName: 'Carlos Hernandez', reportedAt: new Date(Date.now() - 10 * 864e5).toISOString(), resolvedAt: new Date(Date.now() - 8 * 864e5).toISOString() },
        ]);
        await this.routes.save([
            { id: id('TR1'), name: 'Crew shuttle — housing to site', vehicle: 'Ford Transit 350 (CA 7XYZ482)', capacity: 14, driverEmployeeId: id('E12'), projectId: p1, departureTime: '06:15', returnTime: '15:45', pickupPoints: ['Extended Stay Suites', 'Elk Grove Park & Ride', 'Laguna Blvd'], status: 'active', notes: NOTE, createdAt: now },
            { id: id('TR2'), name: 'Office pickup (staff)', vehicle: 'Chevrolet Suburban (CA 8DEF915)', capacity: 4, projectId: p2 || p1, departureTime: '07:30', returnTime: '17:00', pickupPoints: ['Downtown Sacramento', 'Natomas'], status: 'active', createdAt: now },
        ]);
        const riding = [['E06', 'TR1', 'Extended Stay Suites'], ['E07', 'TR1', 'Extended Stay Suites'], ['E10', 'TR1', 'Extended Stay Suites'], ['E11', 'TR1', 'Extended Stay Suites'], ['E09', 'TR1', 'Extended Stay Suites'], ['E13', 'TR1', 'Elk Grove Park & Ride'], ['E08', 'TR1', 'Laguna Blvd'], ['E01', 'TR2', 'Downtown Sacramento'], ['E05', 'TR2', 'Natomas']];
        await this.riders.save(riding.map(([e, r, p], i) => ({ id: id(`TA${i + 1}`), routeId: id(r), employeeId: id(e), pickupPoint: p, startDate: d(-45), byName: 'Jennifer Martinez' })));
        await this.loadTimesheets(p1, p2);
        await this.loadPayroll(actor);
        return { ...(await this.status()), projectsUsed: [p1, p2].filter(Boolean).length };
    }
    async loadTimesheets(p1, p2) {
        if (!this.tsSheets || !this.tsLines)
            return;
        const today = (0, workforce_util_1.todayISO)();
        const id = (x) => exports.SAMPLE + x;
        const monday = (0, calendar_util_1.addDays)(today, -(((0, calendar_util_1.weekday)(today) + 6) % 7));
        const at = (ws, n) => (0, calendar_util_1.addDays)(ws, n);
        const plan = {
            E01: [
                ...(p1 ? [{ kind: 'project', projectId: p1, description: 'Submittals, RFIs and inspections', hours: [8, 8, 8, 8, 4], notes: { 1: 'Fire marshal walk-through' } }] : []),
                ...(p2 ? [{ kind: 'project', projectId: p2, description: 'Coordination meeting and punch list', hours: [0, 0, 0, 0, 2] }] : []),
                { kind: 'internal', category: 'meetings', description: 'Weekly project review', hours: [0, 0, 0, 0, 2] },
            ],
            E02: [{ kind: 'internal', category: 'office', description: 'Payroll, onboarding and benefits', hours: [8, 8, 8, 8, 8], notes: { 4: 'Open enrollment session' } }],
            E04: [
                ...(p1 ? [{ kind: 'project', projectId: p1, description: 'Site supervision and daily logs', hours: [9, 9, 8.5, 9, 8] }] : []),
            ],
            E05: [
                { kind: 'internal', category: 'estimating', description: 'Bid: Riverside medical office', hours: [6, 6, 5, 6, 6] },
                ...(p2 ? [{ kind: 'project', projectId: p2, description: 'Change order pricing', hours: [2, 2, 3, 2, 2] }] : []),
            ],
        };
        const now = new Date().toISOString();
        const sheets = [];
        const lines = [];
        const reviewer = (k) => (k === 'E02' ? 'David Williams' : 'Jennifer Martinez');
        const add = (k, back, status, days = 5, extra = {}) => {
            const ws = at(monday, -7 * back);
            const sid = id(`TS-${k}-${back}`);
            let total = 0;
            (plan[k] || []).forEach((r, j) => {
                const dayMap = {};
                r.hours.slice(0, days).forEach((h, n) => { if (h) {
                    dayMap[at(ws, n)] = r.notes?.[n] ? { hours: h, note: r.notes[n] } : { hours: h };
                    total += h;
                } });
                if (Object.keys(dayMap).length)
                    lines.push({ id: id(`TL-${k}-${back}-${j}`), timesheetId: sid, employeeId: id(k), kind: r.kind, projectId: r.projectId, category: r.category, description: r.description, days: dayMap, leaveRequestIds: [], order: j });
            });
            const submitted = status !== 'draft';
            sheets.push({
                id: sid, employeeId: id(k), weekStart: ws, status, totalHours: total, createdAt: now, updatedAt: now,
                submittedAt: submitted ? `${at(ws, 4)}T23:00:00.000Z` : undefined, submittedByName: submitted ? undefined : undefined,
                decidedAt: ['approved', 'rejected'].includes(status) ? `${at(ws, 7)}T17:00:00.000Z` : undefined,
                decidedByName: ['approved', 'rejected'].includes(status) ? reviewer(k) : undefined, ...extra,
            });
        };
        const name = { E01: 'Michael Thompson', E02: 'Jennifer Martinez', E04: 'David Williams', E05: 'Sarah Chen' };
        for (const k of ['E01', 'E02', 'E04', 'E05']) {
            add(k, 3, 'approved', 5, { submittedByName: name[k] });
            add(k, 2, 'approved', 5, { submittedByName: name[k] });
            if (k === 'E04')
                add(k, 1, 'rejected', 4, { submittedByName: name[k], decisionNote: 'Friday is missing -- you were on site for the pour' });
            else
                add(k, 1, 'approved', 5, { submittedByName: name[k] });
        }
        const daysSoFar = Math.max(1, Math.min(5, (((0, calendar_util_1.weekday)(today) + 6) % 7) + 1));
        add('E05', 0, 'submitted', daysSoFar, { submittedByName: 'Sarah Chen', submittedAt: now, notes: 'Estimating deadline Friday -- may run over' });
        add('E01', 0, 'draft', Math.min(2, daysSoFar));
        await this.tsSheets.save(sheets);
        await this.tsLines.save(lines);
    }
    async loadPayroll(actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'load sample data');
        const st = await this.status();
        if (!st.employees)
            throw new common_1.BadRequestException('Load the sample data first.');
        if (st.payrollRuns && (st.timesheets || !this.tsSheets))
            throw new common_1.BadRequestException('Sample payroll and timesheets are already loaded.');
        if (!st.timesheets && this.tsSheets) {
            const on = async (asg) => (await this.assignments.findOneBy({ id: exports.SAMPLE + asg }))?.projectId;
            await this.loadTimesheets(await on('ASE011'), await on('ASE052'));
        }
        if (st.payrollRuns)
            return this.status();
        const sample = (0, typeorm_2.Like)(`${exports.SAMPLE}%`);
        const today = (0, workforce_util_1.todayISO)();
        const id = (x) => exports.SAMPLE + x;
        const prevStart = monthStart(today, 1), prevEnd = monthEnd(today, 1);
        const curStart = monthStart(today), curEnd = monthEnd(today);
        const { weekendDays } = await this.setup.settings();
        const existing = await this.logs.find({ where: { id: sample } });
        const logged = new Set(existing.map((l) => l.date));
        const projectId = existing[0]?.projectId ?? (await this.assignments.find({ where: { id: sample } }))[0]?.projectId;
        if (projectId != null) {
            const csi = new Map((await this.csi.find()).map((c) => [c.code, c.id]));
            const onLeave = (await this.leave.find({ where: { employeeId: sample } })).filter((r) => r.status === 'approved');
            const away = (k, date) => onLeave.some((r) => r.employeeId === id(k) && r.startDate <= date && r.endDate >= date);
            const first = existing.map((l) => l.date).sort()[0] || today;
            const dates = (0, calendar_util_1.workingDays)(prevStart, (0, calendar_util_1.addDays)(first, -1), weekendDays, new Set()).filter((x) => !logged.has(x));
            const logRows = [];
            const entryRows = [];
            for (const date of dates) {
                const logId = id(`DLP-${date}`);
                logRows.push({ id: logId, projectId, date, supervisorName: 'David Williams', status: 'approved', submittedAt: `${date}T23:30:00.000Z`, approvedByName: 'Michael Thompson', approvedAt: `${(0, calendar_util_1.addDays)(date, 1)}T16:00:00.000Z`, createdAt: `${date}T23:00:00.000Z` });
                SAMPLE_WORK.forEach(([k, code, hours, task], j) => {
                    if (away(k, date))
                        return;
                    if (k === 'E14' && date < (0, calendar_util_1.addDays)(today, -100))
                        return;
                    if (k === 'E16' && date < (0, calendar_util_1.addDays)(today, -55))
                        return;
                    entryRows.push({ id: id(`LEP-${date}-${j}`), dailyLogId: logId, employeeId: id(k), csiCodeId: csi.get(code) || csi.values().next().value, hours, taskDetail: task, taskStatus: 'continued', team: j < 4 ? 'A' : 'B' });
                });
            }
            if (logRows.length)
                await this.logs.save(logRows);
            if (entryRows.length)
                await this.entries.save(entryRows);
            const dateOf = new Map([...existing, ...logRows].map((l) => [l.id, l.date]));
            const clash = (await this.entries.find({ where: { dailyLogId: sample } })).filter((e) => dateOf.has(e.dailyLogId) && away(e.employeeId.slice(exports.SAMPLE.length), dateOf.get(e.dailyLogId)));
            for (const e of clash)
                await this.entries.delete({ id: e.id });
            const otDay = (0, calendar_util_1.workingDays)((0, calendar_util_1.addDays)(prevStart, 9), prevEnd, weekendDays, new Set())[0];
            if (otDay)
                await this.overtime.save({
                    id: id('OT4'), employeeId: id('E13'), projectId, date: otDay, hours: 3, otType: 'normal', status: 'approved', source: 'manual',
                    reason: 'Finishing excavation before the inspector arrived', requestedByName: 'David Williams', decidedByName: 'Michael Thompson', decidedAt: new Date().toISOString(),
                    baseRate: 52, multiplier: 1.5, amount: 234, createdAt: new Date().toISOString(),
                });
        }
        const people = await this.employees.find({ where: { id: sample } });
        const system = { id: actor.id, name: actor.name || 'Sample data', roleKey: 'admin' };
        await this.payroll.createRunFor(people, { id: id('PR1'), label: monthName(prevStart), periodStart: prevStart, periodEnd: prevEnd, notes: NOTE }, 'Jennifer Martinez');
        await this.payroll.finalize(id('PR1'), system);
        const payday = (0, calendar_util_1.workingDays)(curStart, curEnd, weekendDays, new Set())[0] || curStart;
        await this.payroll.markPaid(id('PR1'), 'all', { method: 'bank_transfer', ref: `ACH batch ${payday}`, date: payday }, system);
        await this.payroll.createRunFor(people, { id: id('PR2'), label: monthName(curStart), periodStart: curStart, periodEnd: curEnd, notes: NOTE }, 'Jennifer Martinez');
        return this.status();
    }
    async remove(actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'remove sample data');
        const sample = (0, typeorm_2.Like)(`${exports.SAMPLE}%`);
        const slips = await this.payslips.find({ where: { employeeId: sample } });
        const runIds = Array.from(new Set(slips.map((s) => s.runId)));
        const runs = runIds.length ? (await this.runs.find()).filter((r) => runIds.includes(r.id)) : [];
        const locked = runs.filter((r) => r.status === 'finalized' && !r.id.startsWith(exports.SAMPLE));
        if (locked.length)
            throw new common_1.BadRequestException(`Finalized payroll (${locked.map((r) => r.label).join(', ')}) includes sample employees -- void it first.`);
        await this.payslips.delete({ employeeId: sample });
        await this.payslips.delete({ runId: sample });
        await this.runs.delete({ id: sample });
        for (const run of runs.filter((r) => !r.id.startsWith(exports.SAMPLE))) {
            const left = await this.payslips.find({ where: { runId: run.id } });
            const sum = (f) => Math.round(left.reduce((a, s) => a + f(s), 0) * 100) / 100;
            run.totals = { headcount: left.length, gross: sum((s) => s.gross), deductions: sum((s) => s.deductions), net: sum((s) => s.net), paid: sum((s) => (s.paymentStatus === 'paid' ? s.net : 0)) };
            await this.runs.save(run);
        }
        for (const r of [this.entries, this.leave, this.leaveAdj, this.overtime, this.advances, this.shifts, this.assetIssues, this.beds, this.riders, this.assignments, this.records, this.tsLines, this.tsSheets].filter(Boolean)) {
            await r.delete({ employeeId: sample });
        }
        await this.entries.delete({ dailyLogId: sample });
        await this.complaints.delete({ employeeId: sample });
        for (const r of [this.entries, this.logs, this.overtime, this.requests, this.assetIssues, this.assets, this.complaints, this.beds, this.units, this.riders, this.routes, this.employees, this.contractors]) {
            await r.delete({ id: sample });
        }
        await this.assetIssues.delete({ assetId: sample });
        await this.beds.delete({ bedId: sample });
        await this.riders.delete({ routeId: sample });
        await this.complaints.delete({ unitId: sample });
        await this.employees.update({ supervisorId: sample }, { supervisorId: null });
        await this.employees.update({ hrOfficerId: sample }, { hrOfficerId: null });
        await this.routes.update({ driverEmployeeId: sample }, { driverEmployeeId: null });
        return this.status();
    }
};
exports.SampleDataService = SampleDataService;
exports.SampleDataService = SampleDataService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ContractorEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.SubcontractorTradeEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.CsiCodeEntity)),
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.EmployeeRecordEntity)),
    __param(6, (0, typeorm_1.InjectRepository)(entities_1.EmployeeAssignmentEntity)),
    __param(7, (0, typeorm_1.InjectRepository)(entities_1.WorkforceRequestEntity)),
    __param(8, (0, typeorm_1.InjectRepository)(entities_1.DailyLogEntity)),
    __param(9, (0, typeorm_1.InjectRepository)(entities_1.LaborLogEntryEntity)),
    __param(10, (0, typeorm_1.InjectRepository)(entities_1.LeaveRequestEntity)),
    __param(11, (0, typeorm_1.InjectRepository)(entities_1.LeaveAdjustmentEntity)),
    __param(12, (0, typeorm_1.InjectRepository)(entities_1.OvertimeRequestEntity)),
    __param(13, (0, typeorm_1.InjectRepository)(entities_1.EmployeeAdvanceEntity)),
    __param(14, (0, typeorm_1.InjectRepository)(entities_1.ShiftAssignmentEntity)),
    __param(15, (0, typeorm_1.InjectRepository)(entities_1.AssetEntity)),
    __param(16, (0, typeorm_1.InjectRepository)(entities_1.AssetIssueEntity)),
    __param(17, (0, typeorm_1.InjectRepository)(entities_1.AccommodationUnitEntity)),
    __param(18, (0, typeorm_1.InjectRepository)(entities_1.BedAllocationEntity)),
    __param(19, (0, typeorm_1.InjectRepository)(entities_1.AccommodationIssueEntity)),
    __param(20, (0, typeorm_1.InjectRepository)(entities_1.TransportRouteEntity)),
    __param(21, (0, typeorm_1.InjectRepository)(entities_1.TransportAssignmentEntity)),
    __param(22, (0, typeorm_1.InjectRepository)(entities_1.PayslipEntity)),
    __param(23, (0, typeorm_1.InjectRepository)(entities_1.PayrollRunEntity)),
    __param(27, (0, typeorm_1.InjectRepository)(entities_1.TimesheetEntity)),
    __param(28, (0, typeorm_1.InjectRepository)(entities_1.TimesheetLineEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        payroll_setup_service_1.PayrollSetupService,
        manpower_access_service_1.ManpowerAccess,
        payroll_service_1.PayrollService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], SampleDataService);
//# sourceMappingURL=sample-data.service.js.map