import { DailyReportSummaryService, rfiColumn, taskColumn } from './daily-report-summary.service';

describe('Daily Report Section I figures', () => {
  it('maps task and RFI statuses onto the report columns', () => {
    expect(taskColumn({ status: 'Not started', completed: false, assigneeId: '', assignee: '' } as any)).toBe('To Do');
    expect(taskColumn({ status: 'Not started', completed: false, assigneeId: 'U-1' } as any)).toBe('Assigned');
    expect(taskColumn({ status: 'In progress', completed: false } as any)).toBe('In Progress');
    expect(taskColumn({ status: 'On hold', completed: false } as any)).toBe('On Hold');
    expect(taskColumn({ status: 'Done', completed: true } as any)).toBe('Complete');
    expect(taskColumn({ status: 'Confirmed', completed: true } as any)).toBe('Confirmed');
    expect(['draft', 'open', 'answered', 'closed', 'void'].map(rfiColumn)).toEqual(['To Do', 'In Progress', 'Complete', 'Confirmed', null]);
  });

  it('gives percentages and counts, never dollars, with change-order time stretching the schedule', async () => {
    const repo = (rows: any[]) => ({ find: jest.fn(async () => rows), findOneBy: jest.fn(async () => rows[0] || null) });
    const fin = { context: jest.fn(async () => ({ exists: true, input: 'IN' })) };
    jest.spyOn(require('./finance.calc'), 'computeSov').mockReturnValue({ summary: { revisedContractC: 400_000_00, contractWorkInvoicedC: 100_000_00 } });
    const svc = new DailyReportSummaryService(
      fin as any,
      repo([{ id: 7, estStart: '2026-01-01' }]) as any,
      repo([
        { id: 'T1', startDate: '2026-01-01', endDate: '2026-01-10', status: 'Done', completed: true },
        { id: 'T2', dueDate: '2026-01-10', status: 'Not started', completed: false, assigneeId: 'U-1' },
      ]) as any,
      repo([{ status: 'open' }, { status: 'closed' }]) as any,
      repo([{ status: 'approved', scheduleImpactDays: 10 }, { status: 'draft', scheduleImpactDays: 5 }]) as any,
    );
    const s = await svc.summary(7, '2026-01-10');
    expect(s.percentInvoiced).toBe(25);
    expect(s.scheduleEnd).toBe('2026-01-20'); // 10 days of approved CO time added
    expect(s.percentDuration).toBe(50);       // day 10 of 20
    expect(s.tasks).toMatchObject({ Complete: 1, Assigned: 1 });
    expect(s.rfis).toMatchObject({ 'In Progress': 1, Confirmed: 1 });
    expect(s.changeOrders).toEqual({ approved: 1, draft: 1 });
    expect(JSON.stringify(s)).not.toMatch(/C"|amount|\\$/);
  });
});
