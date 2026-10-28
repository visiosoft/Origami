import { backfillSerials, logSerialKind, nextSerial } from './serials';

describe('serials', () => {
  it('counts per kind and year', () => {
    expect(nextSerial([], 'task', 2026)).toBe('T-2026-0001');
    expect(nextSerial(['T-2026-0007', 'T-2025-0040', 'FR-2026-0099'], 'task', 2026)).toBe('T-2026-0008');
    expect(nextSerial(['T-2025-0040'], 'task', 2026)).toBe('T-2026-0001');
    expect(nextSerial(['MTG-2026-0002'], 'meeting', 2026)).toBe('MTG-2026-0003');
  });
  it('tells FOR RECORD from tasks', () => {
    expect(logSerialKind('Observation')).toBe('record');
    expect(logSerialKind('Task')).toBe('task');
  });
  it('backfills oldest first, per project', () => {
    const rows = [
      { id: 'b', serial: null, p: '1', at: '2026-03-01' },
      { id: 'a', serial: null, p: '1', at: '2026-01-01' },
      { id: 'c', serial: 'T-2026-0005', p: '2', at: '2026-01-01' },
      { id: 'd', serial: null, p: '2', at: '2026-02-01' },
      { id: 'e', serial: null, p: '1', at: '2025-12-01' },
    ];
    expect(backfillSerials(rows, (r) => r.p, () => 'task', (r) => r.at)).toEqual([
      ['e', 'T-2025-0001'], ['a', 'T-2026-0001'], ['d', 'T-2026-0006'], ['b', 'T-2026-0002'],
    ]);
  });
});

import { baseProjectCode, cleanProjectCode, newTaskId, projectCodes, taskNumber } from './serials';
describe('task numbers with a project prefix', () => {
  it('makes a code from the name, numbers clashes, keeps codes set by hand', () => {
    expect(baseProjectCode('Narvaes Residence (91-1062 Kuhina St, Ewa Beach)')).toBe('NARV');
    expect(baseProjectCode('The Hadland House')).toBe('HADL');
    expect(baseProjectCode('1311 Countryside Ct')).toBe('1311');
    const codes = projectCodes([{ id: 2, name: 'Narvaes Cottage' }, { id: 1, name: 'Narvaes Residence' }, { id: 3, name: 'Hadland', code: 'narv' }]);
    expect([codes.get(1), codes.get(2), codes.get(3)]).toEqual(['NARV2', 'NARV3', 'NARV']);
    expect(cleanProjectCode(' k-1 ')).toBe('K1');
    expect(cleanProjectCode('x')).toBe('');
    expect(taskNumber('T-2026-0007', 'NARV')).toBe('NARV-T-2026-0007');
    expect(taskNumber('T-2026-0007', null)).toBe('GEN-T-2026-0007');
  });
  it('task ids never repeat, even in the same millisecond', () => {
    const ids = new Set(Array.from({ length: 20000 }, newTaskId));
    expect(ids.size).toBe(20000);
  });
});
