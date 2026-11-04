import { queryRfis } from './rfi-query';
import { queryLog } from '../tasks/task-query';
import { cleanMarkup } from '../file-room/markups';

/** Nov 3 sync: a CSI code on a markup, RFI or task follows the issue through change orders to the contract. */
describe('CSI codes', () => {
  it('filters RFIs by CSI code', () => {
    const rows = [{ id: 'a', number: 1, status: 'open', csiCodeId: 'CSI-03' }, { id: 'b', number: 2, status: 'open', csiCodeId: 'CSI-09' }, { id: 'c', number: 3, status: 'open' }];
    expect(queryRfis(rows, { status: 'all', csi: 'CSI-03', today: '2026-11-04' }).rows.map((r: any) => r.id)).toEqual(['a']);
    expect(queryRfis(rows, { status: 'all', today: '2026-11-04' }).rows).toHaveLength(3);
  });
  it('filters the Special Actions Log by CSI code', () => {
    const rows: any[] = [{ id: 'A', tab: 'internal', subject: 'Footing', status: 'To Do', csiCodeId: 'CSI-03' }, { id: 'B', tab: 'internal', subject: 'Paint', status: 'To Do', csiCodeId: 'CSI-09' }];
    expect(queryLog(rows, { id: 'U-1', name: 'Ed' } as any, { tab: 'internal', csi: 'CSI-03' }).rows.map((x: any) => x.id)).toEqual(['A']);
  });
  it('keeps a markup’s CSI code', () => {
    expect(cleanMarkup({ kind: 'cloud', page: 1, data: { points: [[0.1, 0.1], [0.2, 0.2]], csiCodeId: ' CSI-03 ' } }).data.csiCodeId).toBe('CSI-03');
  });
});
