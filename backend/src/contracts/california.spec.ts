import { cancelByDay, cancelByText, checkDraws, downPaymentCap, federalHolidays, fillLive, parsePrice } from './california';
import { DEFAULT_TEMPLATES, mergeContract, unfilledFields } from './contract-types';

describe('California contract rules (Nov 13)', () => {
  it('federal holidays, observed on a weekday', () => {
    const h = federalHolidays(2026);
    for (const d of ['2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25']) expect(h.has(d)).toBe(true);
    expect(h.has('2026-07-04')).toBe(false); // a Saturday: observed Friday the 3rd
  });

  it('three business days after signing, not counting the signing day, weekends or federal holidays', () => {
    expect(cancelByDay('2026-11-16')).toBe('2026-11-19'); // Mon -> Thu
    expect(cancelByDay('2026-11-13')).toBe('2026-11-18'); // Fri -> Mon 16, Tue 17, Wed 18
    expect(cancelByDay('2026-11-24')).toBe('2026-11-30'); // Tue -> Wed 25, (Thanksgiving 26), Fri 27, Mon 30
    expect(cancelByDay('2026-11-10')).toBe('2026-11-16'); // Tue -> (Veterans Day 11) Thu 12, Fri 13, Mon 16
    expect(cancelByText('2026-11-16')).toBe('midnight at the end of Thursday, November 19, 2026');
    expect(cancelByText(null)).toMatch(/third business day/);
  });

  it('down payment: $1,000 or 10%, whichever is less; payments add up to the price', () => {
    expect(downPaymentCap(185000)).toBe(1000);
    expect(downPaymentCap(8000)).toBe(800);
    const ok = checkDraws([
      { label: 'Down payment', kind: 'down', mode: 'amt', value: 1000 },
      { label: 'Mobilization', kind: 'mobilization', mode: 'amt', value: 9000 },
      { label: 'Framing', kind: 'progress', mode: 'amt', value: 90000 },
      { label: 'Completion', kind: 'final', mode: 'amt', value: 85000 },
    ], 185000);
    expect(ok.errors).toEqual([]);
    const bad = checkDraws([{ label: 'Down', kind: 'down', mode: 'pct', value: 10 }, { label: 'Rest', kind: 'progress', mode: 'pct', value: 80 }], 185000);
    expect(bad.errors.join(' ')).toMatch(/at most \$1,000\.00/);
    expect(bad.errors.join(' ')).toMatch(/add up to \$166,500\.00, not the contract price of \$185,000\.00/);
    // 100% in percentages: the last row takes the rounding cent.
    const thirds = checkDraws([{ label: 'A', kind: 'progress', mode: 'pct', value: 33.33 }, { label: 'B', kind: 'progress', mode: 'pct', value: 33.33 }, { label: 'C', kind: 'progress', mode: 'pct', value: 33.34 }], 1000.01);
    expect(thirds.total).toBe(1000.01);
    expect(parsePrice('$185,000.00')).toBe(185000);
  });

  it('the cancel-by date, schedule and drawing list fill in when shown; they don’t block drafting', () => {
    const html = mergeContract(DEFAULT_TEMPLATES.gc.html, { 'company.name': 'Origami' });
    expect(unfilledFields(html)).not.toContain('cancel_by');
    expect(html).toContain('{{cancel_by}}');
    const c = { amount: '$10,000.00', drawSchedule: [{ label: 'Down', kind: 'down' as const, mode: 'amt' as const, value: 1000 }, { label: 'Rest', kind: 'final' as const, mode: 'amt' as const, value: 9000 }],
      attachments: [{ name: 'A-101 Floor plan.pdf', kind: 'drawings' }, { name: 'Estimate.pdf', kind: 'estimate' }], parties: [{ internal: false, role: 'owner', signedAt: '2026-11-16T18:00:00Z' }] };
    const shown = fillLive(html, c);
    expect(shown).toContain('midnight at the end of Thursday, November 19, 2026');
    expect(shown).toContain('A-101 Floor plan.pdf');
    expect(shown).not.toContain('Estimate.pdf');
    expect(shown).toContain('$9,000.00');
    expect(shown).not.toMatch(/\{\{(cancel_by|draw_schedule|drawing_list)\}\}/);
  });
});
