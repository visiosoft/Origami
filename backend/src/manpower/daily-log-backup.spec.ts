import { dailyLogCsv, dailyLogRows } from './daily-log-backup.service';
import { reportSectionsHtml } from './daily-report.html';

describe('daily log backup', () => {
  const employees: any[] = [{ id: 'E1', name: 'Robert Johnson', workerId: 'W-101', trade: 'Carpenter' }, { id: 'E2', name: 'Luis Ortega', workerId: 'W-102', trade: 'Laborer' }];
  const codes: any[] = [{ id: 'C06', code: '06 10 00', division: 'Rough Carpentry' }, { id: 'C03', code: '03 30 00', division: 'Concrete' }];
  const entries: any[] = [
    { employeeId: 'E1', csiCodeId: 'C06', hours: 8, taskStatus: 'continued', team: 'A', taskDetail: 'Framing, east wall' },
    { employeeId: 'E2', csiCodeId: 'C03', hours: 10, taskStatus: 'start', team: '', taskDetail: 'Pour "footing" B, then cleanup' },
  ];

  it('lists the day by cost code with names, IDs and trades', () => {
    const rows = dailyLogRows(entries, employees, codes);
    expect(rows.map((r) => r.worker)).toEqual(['Luis Ortega', 'Robert Johnson']);
    expect(rows[1]).toMatchObject({ workerId: 'W-101', trade: 'Carpenter', code: '06 10 00', division: 'Rough Carpentry', hours: 8, status: 'Continued', team: 'A' });
  });

  it('builds a spreadsheet with a total and the notes, quoting what needs it', () => {
    const csv = dailyLogCsv({ project: '1311 Countryside Ct', date: 'Friday, September 25, 2026', supervisor: 'George Finau', status: 'submitted', notes: 'Weather delay\nInspection passed' }, dailyLogRows(entries, employees, codes));
    expect(csv).toContain('Worker,Worker ID,Trade,Cost code,Division,Hours,Task,Team,What they worked on');
    expect(csv).toContain('"Pour ""footing"" B, then cleanup"');
    expect(csv).toContain('Total,,,,,18');
    expect(csv).toContain('"Weather delay\nInspection passed"');
  });
});

describe('VII / VIII in the spreadsheet and the PDF', () => {
  const sections = {
    activity: { worked: 'yes' },
    deliveries: { present: 'yes', transmittal: 'yes', files: [], rows: [{ id: 'a', supplier: 'Home Depot', poRef: 'PO-9', items: 'Ply', qty: 40, condition: 'damaged', notes: 'Two sheets cracked' }, { id: 'b' }] },
    equipment: { used: 'yes', form: 'yes', files: [], rows: [{ id: 'e', equipment: 'Excavator', ownership: 'rented', supplier: 'Sunbelt', operator: 'Kai', hoursUsed: 6, hoursIdle: 2 }] },
  };
  it('adds the transmittal and equipment blocks to the CSV, skipping empty rows', () => {
    const csv = dailyLogCsv({ project: 'P', date: 'D', supervisor: 'S', status: 'submitted', sections }, []);
    expect(csv).toContain('Transmittal (deliveries)');
    expect(csv).toContain('Home Depot,PO-9,Ply,40,,damaged,Two sheets cracked');
    expect(csv).toContain('Excavator,rented,Sunbelt,Kai,6,2,');
    expect(csv.split('Home Depot').length).toBe(2);
  });
  it('prints them as tables in the PDF', () => {
    const html = reportSectionsHtml(sections, {});
    expect(html).toContain('Damaged');
    expect(html).toContain('Rented from Sunbelt');
    expect(html).toMatch(/<b>6<\/b>/);
  });
});

