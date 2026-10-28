import { buildWeekly, weeklyCsv, weeklyHtml } from './weekly-report.service';

const log = (o: any) => ({ projectId: 7, version: 1, status: 'submitted', supervisorName: 'George', sections: { activity: { worked: 'yes' } }, notes: '', ...o });
const employees = [{ id: 'E1', name: 'Robert', trade: 'Carpenter' }, { id: 'E2', name: 'Luis', trade: 'Laborer' }];
const codes = [{ id: 'C6', code: '06 10 00', division: 'Rough Carpentry' }];

describe('weekly report', () => {
  const logs: any[] = [
    log({ id: 'mon1', date: '2026-10-12' }),
    log({ id: 'mon2', date: '2026-10-12', version: 2 }),                              // the update replaces Monday
    log({ id: 'tue', date: '2026-10-13', status: 'approved', sections: {
      activity: { worked: 'yes', delays: 'yes', dOps: { rfi: { on: true, getWell: 'known', date: '2026-10-20', details: 'Waiting on RFI-004' } } },
      deliveries: { present: 'yes', rows: [{ id: 'd', supplier: 'Home Depot', items: 'Ply', qty: 40, condition: 'damaged' }, { id: 'x' }] },
      equipment: { used: 'yes', rows: [{ id: 'e', equipment: 'Excavator', ownership: 'rented', hoursUsed: 6, hoursIdle: 2 }] },
      notes: [{ id: 'n', text: 'Footings poured' }],
    } }),
    log({ id: 'wed', date: '2026-10-14', autoReason: 'holiday', sections: { activity: { worked: 'no', reason: 'holiday' } } }),
    log({ id: 'thu', date: '2026-10-15', status: 'draft' }),                        // drafts don't count
    log({ id: 'other', date: '2026-10-13', projectId: 8 }),                         // another project
  ];
  const entries: any[] = [
    { dailyLogId: 'mon1', employeeId: 'E1', hours: 4, csiCodeId: 'C6' },
    { dailyLogId: 'mon2', employeeId: 'E1', hours: 8, csiCodeId: 'C6' },
    { dailyLogId: 'tue', employeeId: 'E1', hours: 8, csiCodeId: 'C6' },
    { dailyLogId: 'tue', employeeId: 'E2', hours: 6 },
  ];
  const w = buildWeekly(7, '2026-10-12', logs, entries, employees, codes, '2026-10-16');

  it('uses the latest filed version of each day and flags weekdays with no report', () => {
    expect(w.days.map((d) => d.logId)).toEqual(['mon2', 'tue', 'wed', null, null, null, null]);
    expect(w.days[0].updates).toBe(1);
    expect(w.totals).toMatchObject({ hours: 22, workerDays: 3, daysWorked: 2, daysNoWork: 1, daysMissing: 2, equipmentHours: 6, equipmentIdle: 2, deliveries: 1 });
    expect(w.days[2]).toMatchObject({ worked: 'no', reason: 'Holiday', auto: true });
  });

  it('totals hours by cost code and by worker', () => {
    expect(w.byCode).toEqual([{ code: '06 10 00', label: '06 10 00 Rough Carpentry', hours: 16, workers: 1 }, { code: '', label: 'No cost code', hours: 6, workers: 1 }]);
    expect(w.byWorker[0]).toEqual({ name: 'Robert', trade: 'Carpenter', hours: 16, days: 2 });
  });

  it('collects the week’s delays, deliveries, equipment and notes', () => {
    expect(w.delays).toEqual([{ date: '2026-10-13', label: 'RFI delay', getWell: '2026-10-20', details: 'Waiting on RFI-004' }]);
    expect(w.deliveries[0]).toMatchObject({ supplier: 'Home Depot', condition: 'damaged' });
    expect(w.equipment).toEqual([{ name: 'Excavator', ownership: 'rented', hoursUsed: 6, hoursIdle: 2, days: 1 }]);
    expect(w.notes).toEqual([{ date: '2026-10-13', text: 'Footings poured' }]);
  });

  it('renders a spreadsheet and a PDF page', () => {
    expect(weeklyCsv('Chelliah', w)).toContain('Excavator,rented,1,6,2');
    expect(weeklyHtml('Chelliah', 'Origami', w)).toContain('2 weekdays with no report');
  });
});
