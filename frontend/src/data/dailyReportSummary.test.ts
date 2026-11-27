import { describe, expect, it } from 'vitest';
import { emptySections, reportSummary } from './dailyReport';

describe('reportSummary (Nov 27: the whole report beside its hours)', () => {
  it('lists what was filled in, section by section, and leaves empty ones out', () => {
    const s = emptySections();
    s.activity.worked = 'yes'; s.activity.delays = 'yes'; s.activity.dOps = { rfi: { on: true, details: 'Waiting on RFI-004' } };
    s.subs.rows = [{ id: 'a', name: 'Bay Electric', headcount: 3, work: 'Rough-in' }];
    s.inspectors.rows = [{ id: 'b', authority: 'City', what: 'Framing', outcome: 'passed' }];
    s.notes = [{ id: 'n', text: 'Owner visited at 2pm' }];
    expect(reportSummary(s)).toEqual([
      { heading: 'Delays', lines: ['RFI delay — Waiting on RFI-004'] },
      { heading: 'Subcontractors', lines: ['Bay Electric · 3 on site · Rough-in'] },
      { heading: 'Inspections', lines: ['City · Framing · Passed'] },
      { heading: 'Notes', lines: ['Owner visited at 2pm'] },
    ]);
    expect(reportSummary(emptySections())).toEqual([]);
  });
});
