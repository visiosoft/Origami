import { shiftOn, workingDays } from './calendar.util';
import { ShiftsService } from './shifts.service';
import { AssetsService, nextAssetTag } from './assets.service';
import { AccommodationService, validParent } from './accommodation.service';
import { TransportService } from './transport.service';
import {
  AccommodationUnitEntity, AssetEntity, AssetIssueEntity, BedAllocationEntity, EmployeeEntity, ShiftAssignmentEntity, TransportAssignmentEntity,
} from '../database/entities';
import type { Actor, ManpowerAccess } from './manpower-access.service';

function table<T extends { id: any }>(rows: T[]) {
  const match = (row: any, where: any) => Object.entries(where || {}).every(([k, v]: [string, any]) =>
    v && typeof v === 'object' && '_value' in v ? (v._value as any[]).includes(row[k]) : row[k] === v);
  const t: any = {
    rows,
    find: jest.fn(async (opts?: any) => rows.filter((r) => match(r, opts?.where))),
    findBy: jest.fn(async (where: any) => rows.filter((r) => match(r, where))),
    findOneBy: jest.fn(async (where: any) => rows.find((r) => match(r, where)) ?? null),
    count: jest.fn(async (opts?: any) => rows.filter((r) => match(r, opts?.where)).length),
    create: jest.fn((x: any) => ({ ...x })),
    save: jest.fn(async (x: any) => { for (const it of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((r) => r.id === it.id); if (i >= 0) rows[i] = it; else rows.push(it); } return x; }),
    remove: jest.fn(async (x: any) => { for (const it of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((r) => r.id === it.id); if (i >= 0) rows.splice(i, 1); } return x; }),
  };
  return t;
}
/** Gives each table a manager whose transactions run against the same in-memory tables. */
function withManager(map: Map<any, any>) {
  const manager = { getRepository: (e: any) => map.get(e), transaction: async (fn: any) => fn(manager) };
  for (const t of map.values()) t.manager = manager;
}

const hr: Actor = { id: 'U-HR', name: 'HR', roleKey: 'hr' };
const access = {
  can: jest.fn(async () => true),
  require: jest.fn(async (a: Actor, _m: string, what: string) => { if (a.roleKey !== 'hr') throw new Error(`not allowed to ${what}`); }),
} as unknown as ManpowerAccess;
const emp = (id: string, over: Partial<EmployeeEntity> = {}) => ({ id, name: id, status: 'active', employmentStatus: 'active', ...over }) as EmployeeEntity;

describe('calendar helpers', () => {
  it('rotates between shifts every N days from the start', () => {
    const a = { templateIds: ['D', 'N'], rotateEveryDays: 7, startDate: '2026-09-07', endDate: null };
    expect(shiftOn(a, '2026-09-06')).toBeNull();
    expect(shiftOn(a, '2026-09-13')).toBe('D');
    expect(shiftOn(a, '2026-09-14')).toBe('N');
    expect(shiftOn(a, '2026-09-21')).toBe('D');
  });
  it('lists working days, skipping weekends and holidays', () => {
    expect(workingDays('2026-09-25', '2026-09-28', [0], new Set(['2026-09-26']))).toEqual(['2026-09-25', '2026-09-28']);
  });
});

describe('ShiftsService', () => {
  it('a new assignment ends the previous one the day before, keeping history', async () => {
    const assigns = table<ShiftAssignmentEntity>([{ id: 'SA1', employeeId: 'E1', templateIds: ['SH-DAY'], startDate: '2026-08-01' } as any]);
    withManager(new Map([[ShiftAssignmentEntity, assigns]]));
    const templates = table<any>([{ id: 'SH-DAY' }, { id: 'SH-NIGHT' }]);
    const svc = new ShiftsService(templates, assigns, table([emp('E1')]), access);
    await svc.assign({ employeeIds: ['E1'], templateIds: ['SH-DAY', 'SH-NIGHT'], rotateEveryDays: 7, startDate: '2026-10-01' }, hr);
    expect(assigns.rows.find((a: any) => a.id === 'SA1').endDate).toBe('2026-09-30');
    expect(assigns.rows).toHaveLength(2);
    await expect(svc.assign({ employeeIds: ['E1'], templateIds: ['SH-DAY', 'SH-NIGHT'], startDate: '2026-11-01' }, hr)).rejects.toThrow(/how many days/);
  });
});

describe('AssetsService', () => {
  const setup = () => {
    const assets = table<AssetEntity>([]);
    const issues = table<AssetIssueEntity>([]);
    withManager(new Map<any, any>([[AssetEntity, assets], [AssetIssueEntity, issues]]));
    return { svc: new AssetsService(assets, issues, table([emp('E1'), emp('E9', { employmentStatus: 'resigned' })]), access), assets, issues };
  };

  it('tags assets in sequence without reusing numbers', () => {
    expect(nextAssetTag(['AST-0001', 'AST-0004', null])).toBe('AST-0005');
  });

  it('issue -> return -> reissue, and lost items leave stock with a charge', async () => {
    const { svc, assets } = setup();
    const laptop = await svc.create({ name: 'Dell Latitude', category: 'laptop', serialNumber: 'SN1' }, hr);
    expect(laptop.assetTag).toBe('AST-0001');
    await expect(svc.create({ name: 'Other', serialNumber: 'SN1' }, hr)).rejects.toThrow(/already registered/);
    await expect(svc.issue(laptop.id, { employeeId: 'E9' }, hr)).rejects.toThrow(/no longer works/);
    const i1 = await svc.issue(laptop.id, { employeeId: 'E1', date: '2026-09-01' }, hr);
    await expect(svc.issue(laptop.id, { employeeId: 'E1' }, hr)).rejects.toThrow(/is issued/);
    await svc.returnIssue(i1.id, { date: '2026-09-20', condition: 'damaged', toRepair: true }, hr);
    expect(assets.rows[0]).toMatchObject({ status: 'in_repair', condition: 'damaged' });
    await svc.setStatus(laptop.id, 'available', hr);
    const i2 = await svc.issue(laptop.id, { employeeId: 'E1', date: '2026-09-21' }, hr);
    const lost = await svc.reportLost(i2.id, { chargeAmount: 25000 }, hr);
    expect(lost).toMatchObject({ status: 'lost', chargeAmount: 25000 });
    expect(assets.rows[0].status).toBe('lost');
  });
});

describe('AccommodationService', () => {
  it('only nests units in order (floors optional)', () => {
    expect(validParent('camp', null)).toBe(true);
    expect(validParent('room', 'building')).toBe(true);
    expect(validParent('bed', 'room')).toBe(true);
    expect(validParent('bed', 'building')).toBe(false);
    expect(validParent('building', null)).toBe(false);
  });

  it('won\'t double-book a bed, and moving someone checks them out of the old bed', async () => {
    const units = table<AccommodationUnitEntity>([
      { id: 'B1', level: 'bed', name: 'Bed 1', active: true } as any,
      { id: 'B2', level: 'bed', name: 'Bed 2', active: true } as any,
    ]);
    const allocs = table<BedAllocationEntity>([]);
    withManager(new Map<any, any>([[BedAllocationEntity, allocs]]));
    const svc = new AccommodationService(units, allocs, table([]), table([emp('E1'), emp('E2')]), access);
    await svc.allocate({ bedId: 'B1', employeeId: 'E1', checkIn: '2026-09-01' }, hr);
    await expect(svc.allocate({ bedId: 'B1', employeeId: 'E2', checkIn: '2026-09-05' }, hr)).rejects.toThrow(/taken by E1/);
    await svc.allocate({ bedId: 'B2', employeeId: 'E1', checkIn: '2026-09-10' }, hr);
    expect(allocs.rows[0].checkOut).toBe('2026-09-09');
    expect(allocs.rows).toHaveLength(2);
  });
});

describe('TransportService', () => {
  it('respects seat capacity and moves a rider between routes', async () => {
    const routes = table<any>([
      { id: 'R1', name: 'Route 1', capacity: 1, status: 'active' },
      { id: 'R2', name: 'Route 2', capacity: 10, status: 'active' },
    ]);
    const riders = table<TransportAssignmentEntity>([]);
    withManager(new Map<any, any>([[TransportAssignmentEntity, riders]]));
    const svc = new TransportService(routes, riders, table([emp('E1'), emp('E2')]), table([]), access);
    await svc.addRider('R1', { employeeId: 'E1', startDate: '2026-09-01' }, hr);
    await expect(svc.addRider('R1', { employeeId: 'E2', startDate: '2026-09-02' }, hr)).rejects.toThrow(/full/);
    await svc.addRider('R2', { employeeId: 'E1', startDate: '2026-09-15' }, hr);
    expect(riders.rows[0].endDate).toBe('2026-09-14');
  });
});
