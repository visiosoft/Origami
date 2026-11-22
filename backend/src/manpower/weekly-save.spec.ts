import { WeeklyReportService, WEEKLY_FOLDER } from './weekly-report.service';

/** Nov 17: the weekly report saved as a PDF snapshot in the project's files. */
describe('weekly report into the project files', () => {
  const logs = [
    { id: 'L1', projectId: 7, date: '2026-11-10', status: 'approved' },
    { id: 'L2', projectId: 8, date: '2026-11-11', status: 'draft' },
    { id: 'L3', projectId: 9, date: '2026-11-03', status: 'approved' },
  ];
  const setup = (connected = true) => {
    const uploads: any[] = [];
    const svc = new WeeklyReportService(
      { find: async (o?: any) => (o?.where?.projectId ? logs.filter((l) => l.projectId === o.where.projectId) : logs) } as any,
      { find: async () => [] } as any,
      { findOneBy: async (w: any) => ({ id: w.id, name: w.id === 7 ? 'Countryside' : 'Other' }) } as any,
      { find: async () => [] } as any,
      { find: async () => [] } as any,
      {} as any,
      { isConnected: async () => connected, htmlToPdf: async () => Buffer.from('%PDF') } as any,
      { get: async () => null, getMany: async () => ({}) } as any,
      { upload: async (pid: number, folder: string[], files: any[]) => { uploads.push({ pid, folder, name: files[0].originalname }); return [{ id: 'F1' }]; } } as any,
    );
    return { svc, uploads };
  };

  it('saves the week as a PDF under Reports / Weekly', async () => {
    const { svc, uploads } = setup();
    const r = await svc.saveToFiles(7, '2026-11-12', { name: 'Ed' });
    expect(r).toMatchObject({ saved: true, fileId: 'F1', weekStart: '2026-11-09' });
    expect(uploads).toEqual([{ pid: 7, folder: WEEKLY_FOLDER, name: 'Weekly report 2026-11-09 - Countryside.pdf' }]);
  });

  it('Monday: last week’s report for each project that filed one (not drafts)', async () => {
    const { svc, uploads } = setup();
    expect(await svc.saveLastWeekForAll('2026-11-16')).toEqual({ saved: 1 });
    expect(uploads.map((u) => u.pid)).toEqual([7]);
  });

  it('needs Google connected', async () => {
    const { svc } = setup(false);
    await expect(svc.saveToFiles(7, '2026-11-12')).rejects.toThrow(/Connect a Google account/);
    expect(await svc.saveLastWeekForAll('2026-11-16')).toEqual({ saved: 0 });
  });
});
