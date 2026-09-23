import { Repository } from 'typeorm';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequestEntity } from '../database/entities';

function mockRepo<T extends object>() {
  return {
    findOneBy: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    remove: jest.fn((x) => Promise.resolve(x)),
  } as unknown as jest.Mocked<Repository<T>>;
}

describe('LeaveRequestsService', () => {
  let repo: jest.Mocked<Repository<LeaveRequestEntity>>;
  let service: LeaveRequestsService;

  beforeEach(() => {
    repo = mockRepo<LeaveRequestEntity>();
    service = new LeaveRequestsService(repo);
  });

  it('creates a pending request', async () => {
    const req = await service.create(
      { employeeId: 'EMP-1', type: 'PTO', startDate: '2026-10-01', endDate: '2026-10-03' },
      { name: 'Field Fred' },
    );
    expect((req as any).status).toBe('pending');
  });

  it('approves a pending request and stamps the decider', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'LR-1', status: 'pending' } as LeaveRequestEntity);
    const decided = await service.decide('LR-1', 'approved', undefined, { name: 'Office Olivia' });
    expect(decided.status).toBe('approved');
    expect(decided.decidedBy).toBe('Office Olivia');
  });

  it('refuses to decide an already-decided request', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'LR-1', status: 'denied' } as LeaveRequestEntity);
    await expect(service.decide('LR-1', 'approved', undefined, { name: 'Office Olivia' }))
      .rejects.toThrow(/already been denied/);
  });
});
