import { canPublish, numberCallouts, rfiDraftLayer, rfiPublishedLayer } from './rfi-markups';
import { RfiMarkupsService } from './rfi-markups.service';

/** Nov 17: RFI markups on their own layer until vetted. */
describe('RFI drawing layer', () => {
  it('names the layers and numbers the callouts in drawing order', () => {
    expect(rfiDraftLayer('RFI-007')).toBe('RFI-007 draft');
    expect(rfiPublishedLayer('RFI-007')).toBe('RFI-007');
    expect(numberCallouts([{ id: 'b', createdAt: '2026-11-17T02' }, { id: 'a', createdAt: '2026-11-17T01' }]).map((m) => [m.id, m.n])).toEqual([['a', 1], ['b', 2]]);
    expect(canPublish('draft')).toBe(false);
    expect(canPublish('open')).toBe(false);
    expect(canPublish('answered')).toBe(true);
  });

  const setup = (status: string) => {
    const rfi: any = { id: 'R1', number: 'RFI-007', status, history: [] };
    const marks: any[] = [
      { id: 'm1', fileId: 'F1', layer: 'RFI-007 draft', linkType: 'rfi', linkId: 'R1', createdAt: '1', private: false },
      { id: 'm2', fileId: 'F1', layer: 'Someone', linkType: 'rfi', linkId: 'R1', createdAt: '2', private: false },
    ];
    const layers: any[] = [];
    const svc = new RfiMarkupsService(
      { findOneBy: async () => rfi, save: async (r: any) => r } as any,
      { find: async () => marks, save: async (rows: any) => rows } as any,
      { create: (x: any) => x, save: async (x: any) => { layers.push(x); return x; }, delete: async (w: any) => { const i = layers.findIndex((l) => l.id === w.id); if (i >= 0) layers.splice(i, 1); } } as any,
    );
    return { rfi, marks, layers, svc };
  };

  it('the draft layer is for our team only', async () => {
    const { svc, layers } = setup('draft');
    expect(await svc.draftLayer('R1', 'F1', { name: 'Ehsan' })).toMatchObject({ layer: 'RFI-007 draft' });
    expect(layers[0]).toMatchObject({ id: 'F1|L:rfi-007 draft', audience: 'internal' });
  });

  it('publishing waits for an answer, then moves only the draft markups to the set', async () => {
    const open = setup('open');
    await expect(open.svc.publish('R1', { name: 'Ehsan' })).rejects.toThrow(/answered/);
    const done = setup('answered');
    await done.svc.draftLayer('R1', 'F1', { name: 'Ehsan' });
    expect(await done.svc.publish('R1', { name: 'Ehsan' })).toEqual({ published: 1, layer: 'RFI-007' });
    expect(done.marks[0].layer).toBe('RFI-007');
    expect(done.marks[1].layer).toBe('Someone');
    expect(done.layers).toHaveLength(0);
    expect(done.rfi.history[0].action).toBe('published markups');
  });
});
