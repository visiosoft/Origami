import { Repository } from 'typeorm';
import { DailyLogsService } from './daily-logs.service';
import { DailyLogEntity, LaborLogEntryEntity } from '../database/entities';

function mockRepo<T extends object>() {
  return {
    findOneBy: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    remove: jest.fn((x) => Promise.resolve(x)),
  } as unknown as jest.Mocked<Repository<T>>;
}

describe('DailyLogsService', () => {
  let logs: jest.Mocked<Repository<DailyLogEntity>>;
  let entries: jest.Mocked<Repository<LaborLogEntryEntity>>;
  let service: DailyLogsService;

  beforeEach(() => {
    logs = mockRepo<DailyLogEntity>();
    entries = mockRepo<LaborLogEntryEntity>();
    service = new DailyLogsService(logs, entries);
  });

  describe('save', () => {
    it('creates a new draft daily log with entries when none exists yet', async () => {
      logs.findOneBy.mockResolvedValue(null);
      const result = await service.save(
        { projectId: 7, date: '2026-09-24', notes: 'Poured slab', entries: [{ employeeId: 'EMP-1', hours: 8 }] },
        { name: 'Supervisor Sam', id: 'U-1' },
      );
      expect(result.log.status).toBe('draft');
      expect(result.log.projectId).toBe(7);
      expect(entries.save).toHaveBeenCalled();
    });

    it('refuses to edit a submitted log', async () => {
      logs.findOneBy.mockResolvedValue({ id: 'DL-1', status: 'submitted', projectId: 7, date: '2026-09-24' } as DailyLogEntity);
      await expect(service.save({ projectId: 7, date: '2026-09-24', entries: [] }, { name: 'X' }))
        .rejects.toThrow(/already been submitted/);
    });
  });

  describe('submit -> approve', () => {
    it('flips status to submitted then approved, stamping the approver', async () => {
      const draft = { id: 'DL-1', status: 'draft', projectId: 7, date: '2026-09-24', supervisorId: 'U-1' } as DailyLogEntity;
      logs.findOneBy.mockResolvedValue(draft);
      const submitted = await service.submit('DL-1', { name: 'Supervisor Sam', id: 'U-1' });
      expect(submitted.status).toBe('submitted');

      logs.findOneBy.mockResolvedValue(submitted);
      const approved = await service.approve('DL-1', { name: 'Office Olivia', id: 'U-2' });
      expect(approved.status).toBe('approved');
      expect(approved.approvedByName).toBe('Office Olivia');
    });

    it('blocks a supervisor from approving their own submission', async () => {
      const submitted = { id: 'DL-1', status: 'submitted', projectId: 7, date: '2026-09-24', supervisorId: 'U-1' } as DailyLogEntity;
      logs.findOneBy.mockResolvedValue(submitted);
      await expect(service.approve('DL-1', { name: 'Supervisor Sam', id: 'U-1' }))
        .rejects.toThrow(/own submission/);
    });
  });

  describe('reject', () => {
    it('records the rejection note and rejector', async () => {
      const submitted = { id: 'DL-1', status: 'submitted', projectId: 7, date: '2026-09-24', supervisorId: 'U-1' } as DailyLogEntity;
      logs.findOneBy.mockResolvedValue(submitted);
      const rejected = await service.reject('DL-1', 'Missing CSI codes', { name: 'Office Olivia', id: 'U-2' });
      expect(rejected.status).toBe('rejected');
      expect(rejected.rejectionNote).toBe('Missing CSI codes');
    });
  });

  describe('a worker split across two projects the same day', () => {
    it('creates two independent daily logs, one per project, each with its own entry', async () => {
      logs.findOneBy.mockResolvedValueOnce(null);
      const first = await service.save(
        { projectId: 1, date: '2026-09-24', entries: [{ employeeId: 'EMP-1', hours: 5 }] },
        { name: 'Supervisor Sam', id: 'U-1' },
      );
      logs.findOneBy.mockResolvedValueOnce(null);
      const second = await service.save(
        { projectId: 2, date: '2026-09-24', entries: [{ employeeId: 'EMP-1', hours: 3 }] },
        { name: 'Supervisor Sam', id: 'U-1' },
      );
      expect(first.log.projectId).toBe(1);
      expect(second.log.projectId).toBe(2);
      expect(first.log.id).not.toBe(second.log.id);
    });
  });
});
