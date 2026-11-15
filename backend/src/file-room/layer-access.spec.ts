import { cleanLayerRule, layerAllows, visibleWithLayers } from './markups';
import { MarkupsService } from './markups.service';

const sub = { userId: 'U-SUB', roleKey: 'consultant', internal: false, company: 'Bay Electric' };
const client = { userId: 'U-CL', roleKey: 'client', internal: false, company: null };
const staff = { userId: 'U-ST', roleKey: 'staff', internal: true };

describe('layer access (Oct 30 sync)', () => {
  it('Everyone by default; Internal hides from outside accounts; our team always sees', () => {
    expect(layerAllows(undefined, client)).toBe(true);
    const internal = { layerKey: 'L:x', audience: 'internal' as const };
    expect(layerAllows(internal, client)).toBe(false);
    expect(layerAllows(internal, staff)).toBe(true);
    expect(layerAllows(internal, { userId: 'U-P', roleKey: 'principal', internal: false })).toBe(true);
  });
  it('a picked layer: listed people and companies only (any case)', () => {
    const picked = { layerKey: 'L:e', audience: 'people' as const, people: [{ type: 'company' as const, id: 'bay electric', name: 'Bay Electric' }] };
    expect(layerAllows(picked, sub)).toBe(true);
    expect(layerAllows(picked, client)).toBe(false);
    expect(layerAllows({ ...picked, people: [{ type: 'user', id: 'U-CL', name: 'Jo' }] }, client)).toBe(true);
  });
  it('cleans what is saved; picking nobody is refused', () => {
    expect(cleanLayerRule({ audience: 'bogus' })).toEqual({ audience: 'everyone', people: [] });
    expect(() => cleanLayerRule({ audience: 'people', people: [] })).toThrow(/Pick at least one/);
  });
  it('filters a drawing’s markups; authors keep their own', () => {
    const rows = [
      { id: 1, layer: 'Electrical', authorId: 'U-ST' },
      { id: 2, layer: 'Owner notes', authorId: 'U-ST' },
      { id: 3, layer: 'Electrical', authorId: 'U-SUB' },
    ];
    const rules = [{ layerKey: 'L:electrical', audience: 'internal' as const }];
    expect(visibleWithLayers(rows, rules, client).map((r) => r.id)).toEqual([2]);
    expect(visibleWithLayers(rows, rules, sub).map((r) => r.id)).toEqual([2, 3]);
  });
});

describe('setting who sees a layer', () => {
  const setup = () => {
    const markups = [{ id: 'M1', fileId: 'F1', layer: 'Electrical', authorId: 'U-ST', private: false, createdAt: '1' }];
    const layers: any[] = [];
    const repo = { find: async () => markups };
    const layerRepo = {
      find: async () => layers, findOneBy: async (w: any) => layers.find((l) => l.id === w.id) || null, create: (x: any) => x,
      save: async (x: any) => { const i = layers.findIndex((l) => l.id === x.id); if (i >= 0) layers[i] = x; else layers.push(x); return x; },
      delete: async (w: any) => { const i = layers.findIndex((l) => l.id === w.id); if (i >= 0) layers.splice(i, 1); },
    };
    const svc = new MarkupsService(repo as any, {} as any, {} as any, undefined, undefined, layerRepo as any, { find: async () => [] } as any);
    return { svc, layers };
  };
  it('an author restricts their layer; Everyone removes the rule; someone else is refused', async () => {
    const { svc, layers } = setup();
    const author = { sub: 'U-ST', roleKey: 'staff', tier: 'internal', name: 'Sam' } as any;
    await svc.setLayerAccess('F1', 'L:electrical', { audience: 'internal' }, author);
    expect(layers).toEqual([expect.objectContaining({ id: 'F1|L:electrical', audience: 'internal' })]);
    expect(await svc.list('F1', { sub: 'U-CL', roleKey: 'client', tier: 'client' } as any)).toEqual([]);
    await expect(svc.setLayerAccess('F1', 'L:electrical', { audience: 'everyone' }, { sub: 'U-X', roleKey: 'staff', tier: 'internal' } as any)).rejects.toThrow(/Only someone/);
    await svc.setLayerAccess('F1', 'L:electrical', { audience: 'everyone' }, author);
    expect(layers).toEqual([]);
  });
});
