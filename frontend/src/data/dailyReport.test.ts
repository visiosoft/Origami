import { describe, expect, it } from 'vitest';
import { carriedCount, dayBefore, emptySections, inspectionTask, equipmentFormDone, equipmentHours, isCarried, isRowCarried, normalizeSections, templateOf, transmittalDone } from './dailyReport';

describe('daily report helpers', () => {
  it('fills in a partial or old report so every section exists', () => {
    const s = normalizeSections({ activity: { worked: 'yes' }, subs: { present: 'yes' } });
    expect(s.activity.worked).toBe('yes');
    expect(s.activity.photos).toBe('');
    expect(s.subs.rows).toEqual([]);
    expect(s.notes).toEqual([]);
  });

  it('marks a copied value until it is changed, and ignores blanks', () => {
    const base = normalizeSections({ activity: { worked: 'yes', photos: 'no' }, notes: [{ id: 'n1', text: 'Framing' }] });
    const now = structuredClone(base);
    expect(isCarried(base, now, 'activity.photos')).toBe(true);
    expect(isCarried(base, now, 'activity.delays')).toBe(false); // nothing copied there
    now.activity.photos = 'yes';
    expect(isCarried(base, now, 'activity.photos')).toBe(false);
    expect(isRowCarried(base.notes, now.notes[0])).toBe(true);
    now.notes[0] = { ...now.notes[0], text: 'Framing, level 2' };
    expect(isRowCarried(base.notes, now.notes[0])).toBe(false);
    expect(isCarried(null, now, 'activity.worked')).toBe(false);
  });

  it('counts what is still carried over', () => {
    const base = normalizeSections({ activity: { worked: 'yes', photos: 'yes' }, subs: { present: 'yes', rows: [{ id: 's1', name: 'Ortiz', headcount: 3 }] } });
    const now = structuredClone(base);
    expect(carriedCount(base, now)).toBe(4); // worked, photos, subs.present, the sub row
    now.subs.rows[0].headcount = 4;
    expect(carriedCount(base, now)).toBe(3);
  });

  it('leaves day-specific things out of a template', () => {
    const s = emptySections();
    s.activity.worked = 'no';
    s.activity.reason = 'stop';
    s.activity.stop = { by: 'Owner', asOf: '2026-10-01' };
    s.notes = [{ id: 'n', text: 'Call PG&E', taskId: 'T-1' }];
    s.deliveries.files = [{ id: 'f', name: 'ticket.pdf' }];
    s.activity.dOps = { rfi: { on: true, getWell: 'known', date: '2026-10-20', details: 'RFI 12', taskId: 'T-2' } };
    const t = templateOf(s);
    expect(t.activity.stop).toEqual({});
    expect(t.notes[0]).toEqual({ id: 'n', text: 'Call PG&E' });
    expect(t.deliveries.files).toEqual([]);
    expect(t.activity.dOps.rfi).toEqual({ on: true, getWell: 'known', date: '', details: 'RFI 12' });
    expect(t.activity.reason).toBe('stop');
  });
});

describe('VII / VIII forms', () => {
  it('older reports get empty delivery and equipment rows', () => {
    const s = normalizeSections({ deliveries: { present: 'yes', transmittal: 'yes', files: [] }, equipment: { used: 'no' } });
    expect(s.deliveries.rows).toEqual([]);
    expect(s.equipment.rows).toEqual([]);
  });
  it('a form counts as done once a row is filled in or a file is attached', () => {
    const s = emptySections();
    expect(transmittalDone({ ...s.deliveries, rows: [{ id: 'a' }] })).toBe(false);
    expect(transmittalDone({ ...s.deliveries, rows: [{ id: 'a', items: '40 sheets ply' }] })).toBe(true);
    expect(equipmentFormDone({ ...s.equipment, files: [{ id: 'f', name: 'form.pdf' }] })).toBe(true);
    expect(equipmentHours([{ id: 'a', hoursUsed: 6, hoursIdle: 2 }, { id: 'b', hoursUsed: '' }])).toEqual({ used: 6, idle: 2 });
  });
  it('a template keeps the usual suppliers and machines, not the day’s quantities and hours', () => {
    const s = emptySections();
    s.deliveries.rows = [{ id: 'd', supplier: 'Home Depot', contractorId: 'C1', items: 'ply', qty: 40, condition: 'damaged', taskId: 'T' }];
    s.equipment.rows = [{ id: 'e', equipment: 'Excavator', ownership: 'rented', supplier: 'Sunbelt', operator: 'Kai', hoursUsed: 6, notes: 'leak', taskId: 'T' }];
    const t = templateOf(s);
    expect(t.deliveries.rows).toEqual([{ id: 'd', supplier: 'Home Depot', contractorId: 'C1' }]);
    expect(t.equipment.rows).toEqual([{ id: 'e', equipment: 'Excavator', ownership: 'rented', supplier: 'Sunbelt', operator: 'Kai' }]);
  });
});

describe('inspection requests (Nov 20)', () => {
  it('make a task due the day before, and older reports read with none', () => {
    expect(dayBefore('2026-12-01')).toBe('2026-11-30');
    expect(dayBefore('')).toBe('');
    const t = inspectionTask({ id: 'r', authority: 'City or Municipal Inspector', areas: 'Foundation, S2.01', date: '2026-11-25', time: '09:00', agency: 'Milpitas Building' }, 'Nov 21, 2026');
    expect(t).toMatchObject({ title: 'Inspection request: City or Municipal Inspector — Foundation, S2.01', dueDate: '2026-11-24' });
    expect(t.description).toMatch(/Wanted on 2026-11-25 at 09:00/);
    expect(normalizeSections({ inspectors: { present: 'no', rows: [] } }).inspectors.requests).toEqual([]);
    expect(templateOf(normalizeSections({ inspectors: { present: 'no', rows: [], requests: [{ id: 'r' }] } })).inspectors.requests).toEqual([]);
  });
});
