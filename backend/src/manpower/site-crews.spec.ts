import { crewLimited, crewOf, outsideCrew } from './site-crews';
import { DailyLogsService } from './daily-logs.service';

/** Nov 17 (Astrid): George should only see and report on his own crew. */
describe('site crews', () => {
  const a = (employeeId: string, supervisorId: string | null, projectId = 7, extra: any = {}) => ({ employeeId, supervisorId, projectId, status: 'active', ...extra });
  const rows = [a('E1', 'U-G'), a('E2', 'U-G'), a('E3', 'U-R'), a('E4', null), a('E5', 'U-G', 8), a('E6', 'U-G', 7, { status: 'ended', endDate: '2026-11-01' })];

  it('who is limited: field roles without Manpower manage rights', () => {
    expect(crewLimited({ sub: 'U-G', roleKey: 'site_super' }, {})).toBe(true);
    expect(crewLimited({ sub: 'U-G', roleKey: 'r_internal_super' }, { manpower_con: { manage: true } })).toBe(false);
    expect(crewLimited({ sub: 'A', roleKey: 'admin' }, {})).toBe(false);
    expect(crewLimited({ sub: 'P', roleKey: 'pm' }, {})).toBe(false);
  });

  it('a crew is the workers reporting to him, still on the job', () => {
    expect([...crewOf(rows as any, 'U-G', '2026-11-18', 7)].sort()).toEqual(['E1', 'E2']);
    expect([...crewOf(rows as any, 'U-G', '2026-11-18')].sort()).toEqual(['E1', 'E2', 'E5']);
  });

  it('names the workers who are not in the crew', () => {
    expect(outsideCrew([{ employeeId: 'E1' }, { employeeId: 'E9' }, { employeeId: 'E9' }], new Set(['E1']), (id) => (id === 'E9' ? 'Ehsan' : id))).toEqual(['Ehsan']);
  });

  it('saving a supervisor’s report with someone outside his crew is refused', async () => {
    const svc = new DailyLogsService({} as any, {} as any, undefined, undefined,
      { find: async () => rows } as any,
      { find: async () => [{ id: 'E9', name: 'Ehsan' }] } as any);
    await expect(svc.assertCrew({ projectId: 7, entries: [{ employeeId: 'E1' }, { employeeId: 'E9' }] }, 'U-G')).rejects.toThrow(/Ehsan isn’t in your crew/);
    await expect(svc.assertCrew({ projectId: 7, entries: [{ employeeId: 'E1' }, { employeeId: 'E2' }] }, 'U-G')).resolves.toBeUndefined();
  });
});
