import { fileAccessOf, fileAccessOk } from './folder-access';
import { FolderAccessService } from './folder-access.service';

/** Nov 17: Internal / Client / External tags on every file. */
describe('file access tags', () => {
  const staff = { staff: true, tier: 'internal' };
  const client = { staff: false, tier: 'client' };
  const consultant = { staff: false, tier: 'consultant' };

  it('untagged means internal', () => {
    expect(fileAccessOf(null)).toBe('internal');
    expect(fileAccessOf('nonsense')).toBe('internal');
  });
  it('staff see everything; clients Client and External; others External only', () => {
    for (const a of [null, 'internal', 'client', 'external']) expect(fileAccessOk(staff, a)).toBe(true);
    expect(fileAccessOk(client, null)).toBe(false);
    expect(fileAccessOk(client, 'client')).toBe(true);
    expect(fileAccessOk(client, 'external')).toBe(true);
    expect(fileAccessOk(consultant, 'client')).toBe(false);
    expect(fileAccessOk(consultant, 'external')).toBe(true);
  });

  it('the gate checks the tag for files only, folders by their rules', async () => {
    const svc = new FolderAccessService(
      { find: async () => [] } as any,
      { find: async () => [] } as any,
      { isStaff: (c: any) => c?.tier === 'internal', permissions: async () => ({}) } as any,
    );
    const g = await svc.gate({ sub: 'C', email: 'c@x.com', roleKey: 'client', tier: 'client' } as any);
    expect(g(7, ['Drawings'])).toBe(true); // a folder
    expect(g(7, ['Drawings'], null)).toBe(false); // an untagged file
    expect(g(7, ['Drawings'], 'client')).toBe(true);
    await expect(svc.assertFile({ sub: 'C', roleKey: 'client', tier: 'client' } as any, { projectId: 7, folderPath: [], access: null })).rejects.toThrow();
    await expect(svc.assertFile({ sub: 'C', roleKey: 'client', tier: 'client' } as any, { projectId: 7, folderPath: [] })).resolves.toBeUndefined();
    const s = await svc.gate({ sub: 'S', roleKey: 'pm', tier: 'internal' } as any);
    expect(s(7, [], null)).toBe(true);
  });
});
