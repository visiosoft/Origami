import { logCounts, logRows, rfiLogHtml } from './rfi-log';

describe('RFI Log to send (Nov 19)', () => {
  const rows = [
    { number: 'RFI-003', subject: 'Fire Alarm', status: 'draft' },
    { number: 'RFI-002', subject: 'Electrical Service Run', status: 'open', dateSent: '2026-11-03', dateDue: '2026-11-12', ballInCourt: 'Recipient', to: { name: 'Raul', company: 'Elden' } },
    { number: 'RFI-001', subject: 'Old', status: 'void' },
    { number: 'RFI-004', subject: 'Beam <size>', status: 'closed' },
  ];
  it('open first, void left out, overdue counted', () => {
    expect(logRows(rows).map((r) => r.number)).toEqual(['RFI-002', 'RFI-003', 'RFI-004']);
    expect(logCounts(rows, '2026-11-19')).toEqual({ total: 3, open: 1, overdue: 1, answered: 0, closed: 1 });
  });
  it('the page lists them, escaped', () => {
    const html = rfiLogHtml(rows, 'HŌM Cafe', 'Origami', '2026-11-19');
    expect(html).toContain('RFI Log — HŌM Cafe');
    expect(html).toContain('overdue');
    expect(html).toContain('Beam &lt;size&gt;');
    expect(html).not.toContain('RFI-001');
  });
});
