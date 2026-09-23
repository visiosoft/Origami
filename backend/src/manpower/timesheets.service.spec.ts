import { Repository } from 'typeorm';
import { TimesheetsService } from './timesheets.service';
import { DailyLogEntity, LaborLogEntryEntity, ProjectEntity } from '../database/entities';

function mockRepo<T extends object>() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findBy: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(),
  } as unknown as jest.Mocked<Repository<T>>;
}

describe('TimesheetsService', () => {
  let logs: jest.Mocked<Repository<DailyLogEntity>>;
  let entries: jest.Mocked<Repository<LaborLogEntryEntity>>;
  let projects: jest.Mocked<Repository<ProjectEntity>>;
  let service: TimesheetsService;

  beforeEach(() => {
    logs = mockRepo<DailyLogEntity>();
    entries = mockRepo<LaborLogEntryEntity>();
    projects = mockRepo<ProjectEntity>();
    service = new TimesheetsService(logs, entries, projects);
  });

  it('sums an employee\'s hours across two projects logged the same day', async () => {
    const dailyLogA = { id: 'DL-1', projectId: 1, date: '2026-09-24', status: 'approved' } as DailyLogEntity;
    const dailyLogB = { id: 'DL-2', projectId: 2, date: '2026-09-24', status: 'submitted' } as DailyLogEntity;
    (logs.createQueryBuilder as any).mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([dailyLogA, dailyLogB]),
    });
    entries.find.mockResolvedValue([
      { dailyLogId: 'DL-1', employeeId: 'EMP-1', hours: 5, csiCodeId: 'CSI-03' } as LaborLogEntryEntity,
      { dailyLogId: 'DL-2', employeeId: 'EMP-1', hours: 3, csiCodeId: 'CSI-06' } as LaborLogEntryEntity,
    ]);
    projects.findBy.mockResolvedValue([
      { id: 1, name: 'Project One' } as ProjectEntity,
      { id: 2, name: 'Project Two' } as ProjectEntity,
    ]);

    const result = await service.forEmployee('EMP-1', '2026-09-22', '2026-09-28');
    expect(result.totalHours).toBe(8);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r.projectName).sort()).toEqual(['Project One', 'Project Two']);
  });
});
