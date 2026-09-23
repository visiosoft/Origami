import { Repository } from 'typeorm';
import { EmployeesService, nextWorkerId } from './employees.service';
import { expiryStatus } from './employee-records.service';
import { EmployeeEntity, TradeEntity } from '../database/entities';
import { AttachmentsService } from '../google/attachments.service';

function mockRepo<T extends object>() {
  return {
    findOneBy: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    remove: jest.fn((x) => Promise.resolve(x)),
  } as unknown as jest.Mocked<Repository<T>>;
}

describe('nextWorkerId', () => {
  it('starts at W-0001 when nobody has one yet', () => {
    expect(nextWorkerId([])).toBe('W-0001');
  });

  it('continues after the highest existing number, never reusing a gap', () => {
    expect(nextWorkerId(['W-0001', 'W-0007', null, 'custom-9'])).toBe('W-0008');
  });
});

describe('EmployeesService', () => {
  let repo: jest.Mocked<Repository<EmployeeEntity>>;
  let trades: jest.Mocked<Repository<TradeEntity>>;
  let service: EmployeesService;

  beforeEach(() => {
    repo = mockRepo<EmployeeEntity>();
    trades = mockRepo<TradeEntity>();
    service = new EmployeesService(repo, trades, { discard: jest.fn() } as unknown as AttachmentsService);
  });

  it('creates an employee with the full master record and an auto worker id', async () => {
    repo.find.mockResolvedValue([{ workerId: 'W-0003' }] as EmployeeEntity[]);
    trades.findOneBy.mockResolvedValue({ id: 'TRD-05', name: 'Welder' } as TradeEntity);
    const emp: any = await service.create({
      name: 'Muhammad Ali', nationalId: '35202-1234567-1', employmentType: 'daily_wage',
      tradeId: 'TRD-05', skillLevel: 'expert', yearsExperience: 8, department: 'Construction',
    });
    expect(emp.workerId).toBe('W-0004');
    expect(emp.trade).toBe('Welder');
    expect(emp.employmentStatus).toBe('active');
    expect(emp.nationalId).toBe('35202-1234567-1');
  });

  it('refuses an employee with no name', async () => {
    await expect(service.create({ name: '  ' })).rejects.toThrow(/name is required/);
  });

  it('keeps the legacy active/inactive flag in step with the lifecycle status', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'EMP-1', status: 'active', employmentStatus: 'active' } as EmployeeEntity);
    const updated = await service.update('EMP-1', { employmentStatus: 'demobilized' });
    expect(updated.status).toBe('inactive');
  });
});

describe('expiryStatus', () => {
  const today = new Date(2026, 8, 24); // 24 Sep 2026

  it('is "none" with no expiry date', () => {
    expect(expiryStatus(undefined, today)).toBe('none');
  });
  it('is "expired" once the date has passed', () => {
    expect(expiryStatus('2026-09-23', today)).toBe('expired');
  });
  it('is "expiring" within 30 days, including the expiry day itself', () => {
    expect(expiryStatus('2026-09-24', today)).toBe('expiring');
    expect(expiryStatus('2026-10-24', today)).toBe('expiring');
  });
  it('is "valid" further out than that', () => {
    expect(expiryStatus('2026-10-25', today)).toBe('valid');
  });
});
