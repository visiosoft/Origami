import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import {
  AccommodationIssueEntity, AccommodationUnitEntity, AssetEntity, AssetIssueEntity, BedAllocationEntity, ContractorEntity, CsiCodeEntity,
  DailyLogEntity, EmployeeAdvanceEntity, EmployeeAssignmentEntity, EmployeeEntity, EmployeeRecordEntity, LaborLogEntryEntity,
  LeaveAdjustmentEntity, LeaveRequestEntity, OvertimeRequestEntity, PayrollRunEntity, PayslipEntity, ProjectEntity,
  ShiftAssignmentEntity, SubcontractorTradeEntity, TradeEntity, TransportAssignmentEntity, TransportRouteEntity, WorkforceRequestEntity,
} from '../database/entities';
import { HR_MODULE, ManpowerAccess, type Actor } from './manpower-access.service';
import { PayrollSetupService } from './payroll-setup.service';
import { nextAssetTag } from './assets.service';
import { addDays, weekday, workingDays } from './calendar.util';
import { todayISO } from './workforce.util';

/** Every sample row's id starts with this, so removing the sample touches nothing else. */
export const SAMPLE = 'DEMO-';
const NOTE = 'Sample data for testing -- remove it from Setup › Sample Data.';

/**
 * A realistic crew across every HR screen, for trying the system out: staff and
 * daily-wage workers, two subcontractors with their workers, deployment, a week
 * of daily logs, leave, overtime, advances, shifts, assets, housing and transport.
 * Uses the existing projects, trades and cost codes; creates none of those.
 */
@Injectable()
export class SampleDataService {
  constructor(
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    @InjectRepository(ContractorEntity) private readonly contractors: Repository<ContractorEntity>,
    @InjectRepository(SubcontractorTradeEntity) private readonly subTrades: Repository<SubcontractorTradeEntity>,
    @InjectRepository(TradeEntity) private readonly trades: Repository<TradeEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(CsiCodeEntity) private readonly csi: Repository<CsiCodeEntity>,
    @InjectRepository(EmployeeRecordEntity) private readonly records: Repository<EmployeeRecordEntity>,
    @InjectRepository(EmployeeAssignmentEntity) private readonly assignments: Repository<EmployeeAssignmentEntity>,
    @InjectRepository(WorkforceRequestEntity) private readonly requests: Repository<WorkforceRequestEntity>,
    @InjectRepository(DailyLogEntity) private readonly logs: Repository<DailyLogEntity>,
    @InjectRepository(LaborLogEntryEntity) private readonly entries: Repository<LaborLogEntryEntity>,
    @InjectRepository(LeaveRequestEntity) private readonly leave: Repository<LeaveRequestEntity>,
    @InjectRepository(LeaveAdjustmentEntity) private readonly leaveAdj: Repository<LeaveAdjustmentEntity>,
    @InjectRepository(OvertimeRequestEntity) private readonly overtime: Repository<OvertimeRequestEntity>,
    @InjectRepository(EmployeeAdvanceEntity) private readonly advances: Repository<EmployeeAdvanceEntity>,
    @InjectRepository(ShiftAssignmentEntity) private readonly shifts: Repository<ShiftAssignmentEntity>,
    @InjectRepository(AssetEntity) private readonly assets: Repository<AssetEntity>,
    @InjectRepository(AssetIssueEntity) private readonly assetIssues: Repository<AssetIssueEntity>,
    @InjectRepository(AccommodationUnitEntity) private readonly units: Repository<AccommodationUnitEntity>,
    @InjectRepository(BedAllocationEntity) private readonly beds: Repository<BedAllocationEntity>,
    @InjectRepository(AccommodationIssueEntity) private readonly complaints: Repository<AccommodationIssueEntity>,
    @InjectRepository(TransportRouteEntity) private readonly routes: Repository<TransportRouteEntity>,
    @InjectRepository(TransportAssignmentEntity) private readonly riders: Repository<TransportAssignmentEntity>,
    @InjectRepository(PayslipEntity) private readonly payslips: Repository<PayslipEntity>,
    @InjectRepository(PayrollRunEntity) private readonly runs: Repository<PayrollRunEntity>,
    private readonly setup: PayrollSetupService,
    private readonly access: ManpowerAccess,
  ) {}

  async status() {
    const [employees, contractors] = await Promise.all([
      this.employees.count({ where: { id: Like(`${SAMPLE}%`) } }),
      this.contractors.count({ where: { id: Like(`${SAMPLE}%`) } }),
    ]);
    return { loaded: employees > 0 || contractors > 0, employees, contractors };
  }

  async load(actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'load sample data');
    if ((await this.status()).loaded) throw new BadRequestException('Sample data is already loaded. Remove it first to load it fresh.');

    const today = todayISO();
    const d = (n: number) => addDays(today, n);
    const now = new Date().toISOString();
    const id = (s: string) => SAMPLE + s;
    const by = actor.name || 'Sample data';

    // Existing master data this hangs off.
    const allProjects = await this.projects.find();
    const live = allProjects.filter((p) => p.stage !== 'Kickoff');
    const [p1, p2] = (live.length ? live : allProjects).map((p) => p.id);
    const trade = new Map((await this.trades.find()).map((t) => [t.name, t.id]));
    const csi = new Map((await this.csi.find()).map((c) => [c.code, c.id]));
    const sub = new Map((await this.subTrades.find()).map((t) => [t.code, t.id]));
    const { weekendDays } = await this.setup.settings();

    // ---------------------------------------------------------------- contractors
    await this.contractors.save([
      {
        id: id('CTR1'), companyName: 'Al-Noor Electrical Works', contactPerson: 'Rizwan Ahmed', phone: '0300-4567812', email: 'info@alnoor-electrical.pk',
        address: '42 Industrial Estate, Kot Lakhpat, Lahore', contractNumber: 'SC-2026-014', contractStart: d(-120), contractEnd: d(240),
        scopeOfWork: 'Electrical rough-in, conduiting, wiring and DB installation for the tower block.', agreedRates: 'Electrician PKR 2,600/day; helper PKR 1,700/day',
        insuranceProvider: 'EFU General', insurancePolicyNumber: 'EFU-CAR-88213', insuranceExpiry: d(25),
        tradeIds: ['C-10', 'C-7'].map((c) => sub.get(c)).filter(Boolean) as string[], licenseNumber: 'PEC-C4-11872', licenseExpiry: d(300),
        status: 'active', notes: NOTE, attachments: [], createdAt: now, updatedAt: now,
      },
      {
        id: id('CTR2'), companyName: 'Punjab Steel Fixers & Fabricators', contactPerson: 'Ghulam Mustafa', phone: '0321-7788991',
        address: 'Plot 9, Sundar Industrial Estate, Lahore', contractNumber: 'SC-2026-021', contractStart: d(-60), contractEnd: d(20),
        scopeOfWork: 'Rebar cutting, bending and fixing; structural steel erection for podium.', agreedRates: 'Per tonne: PKR 38,000 fixing',
        insuranceProvider: 'Adamjee Insurance', insurancePolicyNumber: 'AI-7731-26', insuranceExpiry: d(-10),
        tradeIds: ['C-50', 'C-51', 'C-60'].map((c) => sub.get(c)).filter(Boolean) as string[], licenseNumber: 'PEC-C5-20931', licenseExpiry: d(15),
        status: 'active', notes: NOTE, attachments: [], createdAt: now, updatedAt: now,
      },
    ] as unknown as ContractorEntity[]);

    // ---------------------------------------------------------------- employees
    type P = Partial<EmployeeEntity> & { k: string; name: string; t?: string };
    const people: P[] = [
      { k: 'E01', name: 'Imran Qureshi', t: 'Engineer', designation: 'Site Engineer', department: 'Projects', grade: 'E-3', employmentType: 'permanent', payType: 'monthly', payRate: 180000, gender: 'male', dob: '1988-04-12', hireDate: '2022-02-01', yearsExperience: 12, skillLevel: 'expert', expertise: ['Structural drawings', 'QA/QC'] },
      { k: 'E02', name: 'Ayesha Malik', designation: 'HR Officer', department: 'Human Resources', grade: 'M-2', employmentType: 'permanent', payType: 'monthly', payRate: 120000, gender: 'female', dob: '1992-09-03', hireDate: '2023-05-15' },
      { k: 'E03', name: 'Tariq Mehmood', t: 'Foreman', designation: 'Foreman', department: 'Site Operations', grade: 'S-2', employmentType: 'permanent', payType: 'monthly', payRate: 95000, gender: 'male', dob: '1981-01-20', hireDate: '2019-08-01', yearsExperience: 20, skillLevel: 'expert' },
      { k: 'E04', name: 'Usman Ghani', t: 'Supervisor', designation: 'Site Supervisor', department: 'Site Operations', grade: 'S-3', employmentType: 'permanent', payType: 'monthly', payRate: 110000, gender: 'male', dob: '1985-06-11', hireDate: '2021-03-01', yearsExperience: 15, skillLevel: 'expert' },
      { k: 'E05', name: 'Farhan Ahmed', t: 'Quantity Surveyor', designation: 'Quantity Surveyor', department: 'Commercial', grade: 'E-2', employmentType: 'contract', payType: 'monthly', payRate: 140000, gender: 'male', dob: '1990-11-30', hireDate: '2024-01-10', yearsExperience: 9, skillLevel: 'skilled' },
      { k: 'E06', name: 'Muhammad Riaz', t: 'Mason', designation: 'Mason', department: 'Site Operations', employmentType: 'daily_wage', payType: 'daily', payRate: 2500, gender: 'male', dob: '1987-03-14', hireDate: '2023-09-01', yearsExperience: 14, skillLevel: 'skilled', expertise: ['Block work', 'Plaster'] },
      { k: 'E07', name: 'Shahid Hussain', t: 'Carpenter', designation: 'Shuttering Carpenter', department: 'Site Operations', employmentType: 'daily_wage', payType: 'daily', payRate: 2400, gender: 'male', dob: '1991-07-22', hireDate: '2024-02-12', yearsExperience: 8, skillLevel: 'skilled', expertise: ['Formwork', 'Shuttering'] },
      { k: 'E08', name: 'Zahid Iqbal', t: 'Electrician', designation: 'Electrician', department: 'MEP', employmentType: 'daily_wage', payType: 'daily', payRate: 2800, gender: 'male', dob: '1993-12-05', hireDate: '2024-06-01', yearsExperience: 7, skillLevel: 'skilled' },
      { k: 'E09', name: 'Naveed Akhtar', t: 'Welder', designation: 'Welder', department: 'Site Operations', employmentType: 'daily_wage', payType: 'daily', payRate: 3000, gender: 'male', dob: '1986-02-18', hireDate: '2022-11-20', yearsExperience: 13, skillLevel: 'expert', expertise: ['MIG', 'TIG', 'ARC'] },
      { k: 'E10', name: 'Kashif Ali', t: 'Steel Fixer', designation: 'Steel Fixer', department: 'Site Operations', employmentType: 'daily_wage', payType: 'daily', payRate: 2300, gender: 'male', dob: '1995-05-09', hireDate: '2025-01-06', yearsExperience: 5, skillLevel: 'semi_skilled' },
      { k: 'E11', name: 'Asif Mehmood', t: 'Helper', designation: 'Helper', department: 'Site Operations', employmentType: 'daily_wage', payType: 'daily', payRate: 1600, gender: 'male', dob: '2000-10-01', hireDate: '2025-07-01', yearsExperience: 1, skillLevel: 'helper' },
      { k: 'E12', name: 'Bilal Ahmed', t: 'Driver', designation: 'Driver (LTV/HTV)', department: 'Logistics', employmentType: 'contract', payType: 'monthly', payRate: 70000, gender: 'male', dob: '1984-08-27', hireDate: '2023-04-01', yearsExperience: 16, skillLevel: 'skilled', equipmentCapabilities: ['Coaster', 'Hilux', 'Dumper'] },
      { k: 'E13', name: 'Sajid Khan', t: 'Equipment Operator', designation: 'Excavator Operator', department: 'Plant', employmentType: 'daily_wage', payType: 'daily', payRate: 3200, gender: 'male', dob: '1983-04-02', hireDate: '2021-10-11', yearsExperience: 18, skillLevel: 'expert', equipmentCapabilities: ['Excavator', 'Backhoe loader'] },
      { k: 'E14', name: 'Waqas Anwar', t: 'Electrician', designation: 'Electrician', employmentType: 'contractor_worker', contractorId: id('CTR1'), siteAccessStatus: 'granted', payType: 'daily', payRate: 2600, gender: 'male', dob: '1994-03-19', hireDate: d(-100), skillLevel: 'skilled' },
      { k: 'E15', name: 'Adnan Saleem', t: 'Electrician', designation: 'Electrician Helper', employmentType: 'contractor_worker', contractorId: id('CTR1'), siteAccessStatus: 'pending', payType: 'daily', payRate: 1700, gender: 'male', dob: '1999-09-09', hireDate: d(-10), skillLevel: 'helper' },
      { k: 'E16', name: 'Rashid Mehmood', t: 'Steel Fixer', designation: 'Steel Fixer', employmentType: 'contractor_worker', contractorId: id('CTR2'), siteAccessStatus: 'granted', payType: 'daily', payRate: 2400, gender: 'male', dob: '1989-12-12', hireDate: d(-55), skillLevel: 'skilled' },
      { k: 'E17', name: 'Hamid Raza', t: 'Painter', designation: 'Painter', department: 'Finishes', employmentType: 'daily_wage', employmentStatus: 'resigned', status: 'inactive', payType: 'daily', payRate: 2200, gender: 'male', dob: '1990-01-01', hireDate: '2023-01-02' },
    ];
    const cnic = (i: number) => `35202-${String(4812000 + i * 1379).slice(0, 7)}-${i % 9 + 1}`;
    const staff = ['E01', 'E02', 'E03', 'E04', 'E05'];
    await this.employees.save(people.map(({ k, t, ...p }, i) => ({
      id: id(k), workerId: `SMP-${String(i + 1).padStart(3, '0')}`, trade: t, tradeId: t ? trade.get(t) : undefined, jobTitle: p.designation,
      fatherOrSpouseName: ['Abdul Qadir', 'Khalid Malik', 'Mehmood Ahmed', 'Ghulam Nabi', 'Nisar Ahmed'][i % 5],
      nationalId: cnic(i + 1), phone: `03${(i % 5) + 0}${i % 2}-${String(5550100 + i * 731).slice(0, 7)}`,
      email: staff.includes(k) ? `${p.name.split(' ')[0].toLowerCase()}@example.com` : undefined,
      emergencyContactName: ['Nasreen Bibi', 'Khalid Malik', 'Rukhsana', 'Sajida Parveen', 'Imtiaz Ahmed'][i % 5],
      emergencyContactRelation: ['Mother', 'Father', 'Wife', 'Wife', 'Brother'][i % 5], emergencyContactPhone: `0345-${String(6660200 + i * 419).slice(0, 7)}`,
      currentAddress: p.contractorId ? undefined : 'Sample Labour Camp, Block A, Raiwind Road, Lahore',
      permanentAddress: ['Village Chak 42, Sheikhupura', 'House 12, Model Town, Lahore', 'Mohalla Islampura, Okara', 'Tehsil Kharian, Gujrat', 'Mardan, KPK'][i % 5],
      bankName: staff.includes(k) || p.payType === 'monthly' ? 'Meezan Bank' : undefined, bankAccount: staff.includes(k) ? `PK36MEZN00${String(1022330000 + i * 77)}` : undefined,
      supervisorId: staff.includes(k) ? (k === 'E03' ? id('E04') : k === 'E04' || k === 'E02' ? undefined : id('E04')) : id('E03'),
      hrOfficerId: k === 'E02' ? undefined : id('E02'), payComponents: [],
      status: 'active', employmentStatus: 'active', ...p, createdAt: now, updatedAt: now,
    })) as unknown as EmployeeEntity[]);

    // ---------------------------------------------------------------- documents, certifications, contracts
    const rec = (k: string, n: number, r: Partial<EmployeeRecordEntity>) => ({ id: id(`R${k}${n}`), employeeId: id(k), attachments: [], verification: 'verified', createdAt: now, notes: NOTE, ...r });
    await this.records.save([
      ...people.filter((p) => !p.contractorId).map((p, i) => rec(p.k, 1, { kind: 'document', type: 'CNIC', number: cnic(i + 1), issueDate: '2021-06-01', expiryDate: p.k === 'E11' ? d(-30) : '2031-06-01' })),
      rec('E09', 2, { kind: 'certification', type: 'Welding certificate', title: '6G pipe welding (ASME IX)', number: 'WLD-6G-4471', issuer: 'TUV Austria Pakistan', issueDate: d(-700), expiryDate: d(20) }),
      rec('E13', 2, { kind: 'certification', type: 'Heavy equipment licence', title: 'Excavator operator', number: 'HEO-9921', issuer: 'NAVTTC', issueDate: d(-1100), expiryDate: d(-5) }),
      rec('E12', 2, { kind: 'certification', type: 'Driving licence', title: 'HTV licence', number: 'LHR-HTV-55120', issuer: 'Punjab Traffic Police', issueDate: d(-900), expiryDate: d(900) }),
      rec('E08', 2, { kind: 'certification', type: 'Electrical licence', title: 'Electrician grade B', number: 'PEC-EL-3380', issuer: 'Pakistan Engineering Council', issueDate: d(-400), expiryDate: d(330) }),
      rec('E01', 2, { kind: 'contract', type: 'permanent', title: 'Employment contract', number: 'EMP-2022-031', issueDate: '2022-02-01', rate: 180000, status: 'active', terms: 'Permanent; 1 month notice; site allowance as per policy.' }),
      rec('E05', 2, { kind: 'contract', type: 'fixed_term', title: 'Fixed-term contract', number: 'EMP-2024-004', issueDate: '2024-01-10', expiryDate: d(40), rate: 140000, status: 'active', terms: 'Fixed term, renewable subject to project needs.' }),
      rec('E12', 3, { kind: 'contract', type: 'project', title: 'Project contract — driver', number: 'EMP-2023-019', issueDate: '2023-04-01', expiryDate: d(-3), rate: 70000, status: 'active' }),
    ] as unknown as EmployeeRecordEntity[]);

    // ---------------------------------------------------------------- deployment
    if (p1) {
      const onP1 = ['E01', 'E03', 'E04', 'E06', 'E07', 'E08', 'E09', 'E10', 'E11', 'E13', 'E14', 'E15', 'E16'];
      const onP2 = p2 ? ['E05', 'E12'] : [];
      const assign = (k: string, projectId: number, extra: Partial<EmployeeAssignmentEntity> = {}) => ({
        id: id(`AS${k}${projectId === p1 ? 1 : 2}`), employeeId: id(k), projectId, tradeId: trade.get(people.find((p) => p.k === k)!.t || ''),
        designation: people.find((p) => p.k === k)!.designation, assignmentType: 'regular', startDate: d(-45), status: 'active', createdByName: by, createdAt: now, ...extra,
      });
      await this.assignments.save([
        ...onP1.map((k) => assign(k, p1, { workArea: ['E06', 'E07', 'E10', 'E11'].includes(k) ? 'Tower A' : ['E08', 'E14', 'E15'].includes(k) ? 'Podium' : undefined })),
        ...onP2.map((k) => assign(k, p2!)),
        ...(p2 ? [assign('E09', p2, { id: id('ASE09T'), assignmentType: 'temporary', startDate: d(1), endDate: d(5), workArea: 'Villa 7', notes: 'Temporary cover for pipe welding' })] : []),
      ] as unknown as EmployeeAssignmentEntity[]);

      await this.requests.save({
        id: id('WR1'), projectId: p2 || p1, workArea: 'Villas 1-8', requiredDate: d(7), durationDays: 30, status: 'submitted',
        lines: [
          { id: 'L1', tradeId: trade.get('Mason') || '', designation: 'Mason', quantity: 4 },
          { id: 'L2', tradeId: trade.get('Helper') || '', designation: 'Helper', quantity: 2 },
          { id: 'L3', tradeId: trade.get('Painter') || '', designation: 'Painter', quantity: 2 },
        ],
        notes: 'Block masonry for boundary walls. ' + NOTE, requestedByName: 'Usman Ghani', submittedAt: now, createdAt: now,
      } as unknown as WorkforceRequestEntity);

      // A week of daily logs on the first project: older days approved, the latest one waiting.
      const days: string[] = [];
      for (let n = 1; days.length < 6 && n < 20; n++) if (!weekendDays.includes(weekday(d(-n)))) days.unshift(d(-n));
      const work: [string, string, number, string][] = [
        ['E06', '04 00 00', 8, 'Block masonry, 3rd floor partition walls'], ['E07', '03 00 00', 8, 'Column shuttering, grid C'],
        ['E10', '03 00 00', 8, 'Rebar fixing, 4th floor slab'], ['E11', '04 00 00', 8, 'Material shifting for masonry'],
        ['E08', '26 00 00', 8, 'Conduiting in slab'], ['E09', '05 00 00', 10, 'Staircase railing welding'],
        ['E13', '31 00 00', 9, 'Excavation for UG water tank'], ['E14', '26 00 00', 8, 'DB installation, podium'],
        ['E16', '03 00 00', 8, 'Rebar fixing, 4th floor slab'],
      ];
      const logRows: Partial<DailyLogEntity>[] = [];
      const entryRows: Partial<LaborLogEntryEntity>[] = [];
      days.forEach((date, i) => {
        const last = i === days.length - 1;
        const logId = id(`DL${i + 1}`);
        logRows.push({
          id: logId, projectId: p1, date, supervisorName: 'Usman Ghani', notes: last ? 'Slab casting prep on 4th floor.' : undefined,
          status: last ? 'submitted' : 'approved', submittedAt: `${date}T18:30:00.000Z`,
          approvedByName: last ? undefined : 'Imran Qureshi', approvedAt: last ? undefined : `${addDays(date, 1)}T09:00:00.000Z`, createdAt: `${date}T18:00:00.000Z`,
        });
        work.forEach(([k, code, hours, task], j) => {
          if (k === 'E06' && i === 2) return; // absent one day
          const h = k === 'E07' && i === days.length - 2 ? 11 : hours; // a long day -> overtime suggestion
          entryRows.push({ id: id(`LE${i + 1}-${j}`), dailyLogId: logId, employeeId: id(k), csiCodeId: csi.get(code) || csi.values().next().value, hours: h, taskDetail: task, taskStatus: i === 0 ? 'start' : last ? 'completing' : 'continued', team: j < 4 ? 'A' : 'B' });
        });
      });
      await this.logs.save(logRows as unknown as DailyLogEntity[]);
      await this.entries.save(entryRows as unknown as LaborLogEntryEntity[]);

      // Overtime: one approved, one waiting.
      await this.overtime.save([
        { id: id('OT1'), employeeId: id('E09'), projectId: p1, date: days[days.length - 3], hours: 2, otType: 'normal', status: 'approved', source: 'daily_log', reason: 'Railing welding had to finish before handover', requestedByName: 'Usman Ghani', decidedByName: 'Imran Qureshi', decidedAt: now, baseRate: 375, multiplier: 1.5, amount: 1125, createdAt: now },
        { id: id('OT2'), employeeId: id('E08'), projectId: p1, date: days[days.length - 1], hours: 3, otType: 'normal', status: 'pending', source: 'manual', reason: 'Conduiting before slab pour', requestedByName: 'Usman Ghani', createdAt: now },
        { id: id('OT3'), employeeId: id('E13'), projectId: p1, date: days[days.length - 2], hours: 4, otType: 'night', status: 'pending', source: 'manual', reason: 'Dewatering the excavation overnight', requestedByName: 'Tariq Mehmood', createdAt: now },
      ] as unknown as OvertimeRequestEntity[]);
    }

    // ---------------------------------------------------------------- leave
    const leaveDays = (a: string, b: string) => workingDays(a, b, weekendDays, new Set()).length;
    const lr = (n: number, k: string, typeId: string, type: string, a: string, b: string, status: string, reason: string, extra: Partial<LeaveRequestEntity> = {}) => ({
      id: id(`LR${n}`), employeeId: id(k), leaveTypeId: typeId, type, startDate: a, endDate: b, halfDay: false, days: leaveDays(a, b), status, reason,
      requestedBy: 'Ayesha Malik', requestedAt: now, decidedBy: status === 'pending' ? undefined : 'Ayesha Malik', decidedAt: status === 'pending' ? undefined : now, ...extra,
    });
    await this.leave.save([
      lr(1, 'E06', 'LT-ANNUAL', 'Annual', d(8), d(10), 'approved', 'Family wedding in Okara'),
      lr(2, 'E07', 'LT-SICK', 'Sick', d(1), d(2), 'pending', 'Fever, doctor advised rest'),
      lr(3, 'E03', 'LT-ANNUAL', 'Annual', d(-30), d(-26), 'approved', 'Annual leave'),
      lr(4, 'E05', 'LT-CASUAL', 'Casual', d(3), d(3), 'pending', 'Bank work', { halfDay: true, days: 0.5 }),
      lr(5, 'E11', 'LT-UNPAID', 'Unpaid', d(-12), d(-10), 'approved', 'Village visit'),
      lr(6, 'E10', 'LT-EMERGENCY', 'Emergency', d(-3), d(-3), 'approved', 'Family emergency'),
    ] as unknown as LeaveRequestEntity[]);

    // ---------------------------------------------------------------- advances & loans
    const approvals = (stages: string[]) => stages.map((stage) => ({ stage, decision: 'approved' as const, byName: stage === 'manager' ? 'Usman Ghani' : stage === 'hr' ? 'Ayesha Malik' : 'Finance Officer', at: now }));
    await this.advances.save([
      { id: id('ADV1'), employeeId: id('E06'), type: 'salary_advance', amount: 15000, requestDate: d(-20), reason: 'School fees', installments: 3, installmentAmount: 5000, deductionStart: d(-5), status: 'disbursed', approvals: approvals(['manager', 'hr', 'finance']), disbursedAt: d(-18), disbursedByName: 'Finance Officer', paymentMethod: 'cash', repayments: [], recovered: 0, createdByName: 'Tariq Mehmood', createdAt: now },
      { id: id('ADV2'), employeeId: id('E10'), type: 'emergency_advance', amount: 8000, requestDate: d(-2), reason: 'Medical treatment for father', installments: 2, installmentAmount: 4000, deductionStart: d(20), status: 'pending_hr', approvals: approvals(['manager']), repayments: [], recovered: 0, createdByName: 'Tariq Mehmood', createdAt: now },
      { id: id('ADV3'), employeeId: id('E01'), type: 'loan', amount: 120000, requestDate: d(-3), reason: 'Motorcycle purchase', installments: 12, installmentAmount: 10000, deductionStart: d(30), status: 'pending_finance', approvals: approvals(['manager', 'hr']), repayments: [], recovered: 0, createdByName: 'Imran Qureshi', createdAt: now },
    ] as unknown as EmployeeAdvanceEntity[]);

    // ---------------------------------------------------------------- shifts
    const shift = (n: number, k: string, templateIds: string[], extra: Partial<ShiftAssignmentEntity> = {}) => ({ id: id(`SA${n}`), employeeId: id(k), templateIds, startDate: d(-14), createdByName: by, createdAt: now, ...extra });
    await this.shifts.save([
      ...['E06', 'E07', 'E10', 'E11', 'E03'].map((k, i) => shift(i + 1, k, ['SH-DAY'])),
      shift(6, 'E08', ['SH-DAY', 'SH-NIGHT'], { rotateEveryDays: 7 }),
      shift(7, 'E14', ['SH-NIGHT', 'SH-DAY'], { rotateEveryDays: 7 }),
      shift(8, 'E13', ['SH-12D']),
      shift(9, 'E09', ['SH-DAY'], { startDate: d(-60), endDate: d(-15) }),
      shift(10, 'E09', ['SH-12N'], { notes: 'Night welding while the crane is free' }),
    ] as unknown as ShiftAssignmentEntity[]);

    // ---------------------------------------------------------------- assets
    const tags = (await this.assets.find()).map((a) => a.assetTag);
    const tag = () => { const t = nextAssetTag(tags); tags.push(t); return t; };
    const assetRows = [
      { k: 'AS1', name: 'Dell Latitude 5440', category: 'laptop', serialNumber: 'DEMO-SN-5440-01', condition: 'good', cost: 285000, purchaseDate: d(-400) },
      { k: 'AS2', name: 'Samsung Galaxy A35', category: 'mobile', serialNumber: 'DEMO-IMEI-35-7781', condition: 'good', cost: 92000, purchaseDate: d(-200) },
      { k: 'AS3', name: 'Bosch GBH 2-26 drill kit', category: 'tools', serialNumber: 'DEMO-BSH-2261', condition: 'fair', cost: 48000, purchaseDate: d(-500) },
      { k: 'AS4', name: 'PPE kit (helmet, boots, vest)', category: 'uniform', condition: 'new', cost: 9500, purchaseDate: d(-30) },
      { k: 'AS5', name: 'Toyota Hilux Revo', category: 'vehicle', serialNumber: 'DEMO-LEB-22-4410', condition: 'good', cost: 9800000, purchaseDate: d(-700) },
      { k: 'AS6', name: 'Jazz SIM (site line)', category: 'sim', serialNumber: 'DEMO-SIM-0300-1122', condition: 'good', cost: 500, purchaseDate: d(-90) },
      { k: 'AS7', name: 'Leica total station TS07', category: 'tools', serialNumber: 'DEMO-LCA-TS07', condition: 'damaged', cost: 1650000, purchaseDate: d(-900), status: 'in_repair' },
    ];
    const issued: [string, string, string, string?][] = [['AS1', 'E01', d(-300)], ['AS2', 'E04', d(-150)], ['AS3', 'E08', d(-40), d(-7)], ['AS5', 'E12', d(-200)], ['AS6', 'E03', d(-80)]];
    await this.assets.save(assetRows.map(({ k, ...a }) => ({
      status: issued.some(([x]) => x === k) ? 'issued' : 'available', ...a, id: id(k), assetTag: tag(), notes: NOTE, createdAt: now, updatedAt: now,
    })) as unknown as AssetEntity[]);
    await this.assetIssues.save([
      ...issued.map(([a, e, at, back], i) => ({ id: id(`AI${i + 1}`), assetId: id(a), employeeId: id(e), issuedAt: at, expectedReturn: back, status: 'open', issuedByName: 'Ayesha Malik' })),
      { id: id('AI9'), assetId: id('AS4'), employeeId: id('E17'), issuedAt: '2023-01-02', status: 'returned', returnedAt: d(-60), returnCondition: 'fair', issuedByName: 'Ayesha Malik', closedByName: 'Ayesha Malik' },
    ] as unknown as AssetIssueEntity[]);

    // ---------------------------------------------------------------- accommodation
    const unit = (k: string, level: string, name: string, parentId?: string) => ({ id: id(k), level, name, parentId, active: true, createdAt: now });
    const unitRows = [unit('C1', 'camp', 'Raiwind Road Labour Camp'), unit('B1', 'building', 'Block A', id('C1')), unit('F1', 'floor', 'Ground floor', id('B1')),
      unit('RM1', 'room', 'Room 101', id('F1')), unit('RM2', 'room', 'Room 102', id('F1')), unit('RM3', 'room', 'Supervisors room', id('B1'))];
    for (const [room, n] of [['RM1', 4], ['RM2', 4], ['RM3', 2]] as [string, number][]) for (let b = 1; b <= n; b++) unitRows.push(unit(`${room}B${b}`, 'bed', `Bed ${b}`, id(room)));
    await this.units.save(unitRows as unknown as AccommodationUnitEntity[]);
    const housed: [string, string][] = [['E06', 'RM1B1'], ['E07', 'RM1B2'], ['E10', 'RM1B3'], ['E11', 'RM1B4'], ['E09', 'RM2B1'], ['E13', 'RM2B2'], ['E08', 'RM2B3'], ['E03', 'RM3B1']];
    await this.beds.save(housed.map(([e, b], i) => ({ id: id(`BA${i + 1}`), bedId: id(b), employeeId: id(e), checkIn: d(-45), byName: 'Ayesha Malik' })) as unknown as BedAllocationEntity[]);
    await this.complaints.save([
      { id: id('AC1'), unitId: id('RM2'), title: 'Water leaking from ceiling', description: 'Leak above bed 3 after rain.', employeeId: id('E08'), status: 'open', reportedByName: 'Tariq Mehmood', reportedAt: now },
      { id: id('AC2'), unitId: id('B1'), title: 'Washroom exhaust fan not working', status: 'in_progress', reportedByName: 'Tariq Mehmood', reportedAt: new Date(Date.now() - 4 * 864e5).toISOString() },
      { id: id('AC3'), unitId: id('RM1'), title: 'Broken window latch', status: 'resolved', resolution: 'Latch replaced by camp maintenance.', reportedByName: 'Muhammad Riaz', reportedAt: new Date(Date.now() - 10 * 864e5).toISOString(), resolvedAt: new Date(Date.now() - 8 * 864e5).toISOString() },
    ] as unknown as AccommodationIssueEntity[]);

    // ---------------------------------------------------------------- transport
    await this.routes.save([
      { id: id('TR1'), name: 'Camp → Site (morning)', vehicle: 'Toyota Coaster LES-8841', capacity: 14, driverEmployeeId: id('E12'), projectId: p1, departureTime: '06:30', returnTime: '18:15', pickupPoints: ['Camp main gate', 'Raiwind Chowk', 'Thokar Niaz Baig'], status: 'active', notes: NOTE, createdAt: now },
      { id: id('TR2'), name: 'City pick-up (staff)', vehicle: 'Toyota Hiace LEA-1207', capacity: 4, projectId: p2 || p1, departureTime: '07:45', returnTime: '17:30', pickupPoints: ['Johar Town', 'Model Town'], status: 'active', createdAt: now },
    ] as unknown as TransportRouteEntity[]);
    const riding: [string, string, string][] = [['E06', 'TR1', 'Camp main gate'], ['E07', 'TR1', 'Camp main gate'], ['E10', 'TR1', 'Camp main gate'], ['E11', 'TR1', 'Camp main gate'], ['E09', 'TR1', 'Camp main gate'], ['E13', 'TR1', 'Raiwind Chowk'], ['E08', 'TR1', 'Thokar Niaz Baig'], ['E01', 'TR2', 'Johar Town'], ['E05', 'TR2', 'Model Town']];
    await this.riders.save(riding.map(([e, r, p], i) => ({ id: id(`TA${i + 1}`), routeId: id(r), employeeId: id(e), pickupPoint: p, startDate: d(-45), byName: 'Ayesha Malik' })) as unknown as TransportAssignmentEntity[]);

    return { ...(await this.status()), projectsUsed: [p1, p2].filter(Boolean).length };
  }

  /** Deletes every sample row, and anything anyone later recorded against a sample employee. */
  async remove(actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'remove sample data');
    const sample = Like(`${SAMPLE}%`);
    const slips = await this.payslips.find({ where: { employeeId: sample } });
    const runIds = Array.from(new Set(slips.map((s) => s.runId)));
    const runs = runIds.length ? (await this.runs.find()).filter((r) => runIds.includes(r.id)) : [];
    const locked = runs.filter((r) => r.status === 'finalized');
    if (locked.length) throw new BadRequestException(`Finalized payroll (${locked.map((r) => r.label).join(', ')}) includes sample employees -- void it first.`);

    await this.payslips.delete({ employeeId: sample });
    for (const run of runs) {
      const left = await this.payslips.find({ where: { runId: run.id } });
      const sum = (f: (s: PayslipEntity) => number) => Math.round(left.reduce((a, s) => a + f(s), 0) * 100) / 100;
      run.totals = { headcount: left.length, gross: sum((s) => s.gross), deductions: sum((s) => s.deductions), net: sum((s) => s.net), paid: sum((s) => (s.paymentStatus === 'paid' ? s.net : 0)) };
      await this.runs.save(run);
    }
    // Employee-linked rows first (including real rows someone added for a sample employee), then the sample rows themselves.
    for (const r of [this.entries, this.leave, this.leaveAdj, this.overtime, this.advances, this.shifts, this.assetIssues, this.beds, this.riders, this.assignments, this.records] as Repository<any>[]) {
      await r.delete({ employeeId: sample });
    }
    await this.entries.delete({ dailyLogId: sample });
    await this.complaints.delete({ employeeId: sample });
    for (const r of [this.entries, this.logs, this.overtime, this.requests, this.assetIssues, this.assets, this.complaints, this.beds, this.units, this.riders, this.routes, this.employees, this.contractors] as Repository<any>[]) {
      await r.delete({ id: sample });
    }
    // Real rows that pointed at a sample asset, bed or route.
    await this.assetIssues.delete({ assetId: sample });
    await this.beds.delete({ bedId: sample });
    await this.riders.delete({ routeId: sample });
    await this.complaints.delete({ unitId: sample });
    // Real people and routes that referred to a sample employee keep their record, minus the link.
    await this.employees.update({ supervisorId: sample }, { supervisorId: null as any });
    await this.employees.update({ hrOfficerId: sample }, { hrOfficerId: null as any });
    await this.routes.update({ driverEmployeeId: sample }, { driverEmployeeId: null as any });
    return this.status();
  }
}
