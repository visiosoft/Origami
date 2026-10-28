import { reportSectionsHtml } from './daily-report.html';

describe('Daily Report PDF sections', () => {
  it('lists the answers, delays and certification, and escapes text', () => {
    const html = reportSectionsHtml({
      activity: { worked: 'yes', delays: 'yes', dOps: { rfi: { on: true, getWell: 'unknown', details: 'RFI <14>' } }, photos: 'no' },
      subs: { present: 'yes', rows: [{ name: 'Ortiz Framing', headcount: 4, from: '07:00', to: '15:30', work: 'Walls' }] },
      inspectors: { present: 'yes', rows: [{ authority: 'Health Department', outcome: 'failed', what: 'Kitchen', delay: { getWell: 'known', date: '2026-10-20', details: 'Re-inspect' } }] },
      notes: [{ id: 'n', text: 'Call PG&E', taskId: 'T1' }],
    }, { onBehalfOf: 'Astrid', certifiedName: 'Astrid', filer: 'George Finau', signedAt: '2026-10-14T20:00:00Z' });
    expect(html).toContain('RFI delay');
    expect(html).toContain('RFI &lt;14&gt;');
    expect(html).toContain('Ortiz Framing');
    expect(html).toContain('Failed');
    expect(html).toContain('get well 2026-10-20');
    expect(html).toContain('Call PG&amp;E');
    expect(html).toContain('on behalf of George Finau');
  });

  it('marks III–IX as N/A on a day without work', () => {
    const html = reportSectionsHtml({ activity: { worked: 'no', reason: 'stop', stop: { by: 'Owner', asOf: '2026-10-14', endUnknown: true } } }, {});
    expect(html).toContain('Stop order');
    expect(html).toContain('projected to end unknown');
    expect(html).toContain('N/A');
    expect(html).not.toContain('IV. Subcontractors');
  });
});
