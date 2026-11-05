import { ForbiddenException } from '@nestjs/common';
import { FileRoomController } from './file-room.controller';

/** Oct 30 sync: field staff view and mark up the build set; only File Room managers change files. */
describe('File Room: who may change files', () => {
  const setup = (perms: any, buildSet: string[] = ['Drawings']) => {
    const service = {
      remove: jest.fn(async (id: string) => ({ id })), move: jest.fn(async () => ({})), upload: jest.fn(async () => [{ id: 'F9' }]),
      buildSetOf: jest.fn(async () => buildSet), setBuildSet: jest.fn(async (pid: number, folders: string[]) => ({ projectId: pid, buildSet: folders })),
    };
    const access = { permissions: jest.fn(async () => perms), assert: jest.fn(async () => undefined) };
    const auth = { verify: jest.fn(async () => field), requireActor: jest.fn(async () => ({ name: 'Sam' })) };
    const c = new FileRoomController(service as any, auth as any, access as any, {} as any, {} as any, {} as any);
    return { c, service };
  };
  const field = { sub: 'U-F', roleKey: 'site_super', tier: 'internal' } as any;
  const viewOnly = { planroom: { view: true, manage: false } };

  it('a view-only role can’t delete, move or mark the build set', async () => {
    const { c, service } = setup(viewOnly);
    await expect(c.remove('F1', field)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(c.move('F1', { folderPath: ['X'] } as any, field)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(c.setBuildSet('3', { folders: ['Drawings'] }, field)).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.remove).not.toHaveBeenCalled();
  });
  it('a view-only role still uploads outside the build set (daily report photos), not into it', async () => {
    const { c, service } = setup(viewOnly);
    await c.upload([{}], '3', JSON.stringify(['Daily Reports', '2026-11-03']), 'Bearer x');
    expect(service.upload).toHaveBeenCalledTimes(1);
    await expect(c.upload([{}], '3', JSON.stringify(['drawings']), 'Bearer x')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('a File Room manager (or an admin) can', async () => {
    const { c, service } = setup({ planroom: { view: true, manage: true } });
    await c.remove('F1', field);
    expect(service.remove).toHaveBeenCalledWith('F1');
    expect(await c.setBuildSet('3', { folders: ['Drawings', 'Specifications'] }, { sub: 'U-A', roleKey: 'admin' } as any)).toEqual({ projectId: 3, buildSet: ['Drawings', 'Specifications'] });
  });
});
