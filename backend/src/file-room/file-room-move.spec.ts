import { FileRoomService, parseFolderTemplate } from './file-room.service';

function table(rows: any[] = []) {
  const match = (r: any, w: any) => Object.entries(w || {}).every(([k, v]) => r[k] === v);
  return {
    rows,
    find: jest.fn(async () => rows.slice()),
    findOneBy: jest.fn(async (w: any) => rows.find((r) => match(r, w)) || null),
    create: jest.fn((x: any) => ({ ...x })),
    save: jest.fn(async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); if (i >= 0) rows[i] = x; else rows.push(x); return x; }),
    update: jest.fn(async (w: any, patch: any) => { rows.filter((r) => match(r, w)).forEach((r) => Object.assign(r, patch)); }),
  };
}

describe('File Room: folders and moving files', () => {
  it('reads the folder template one path per line', () => {
    expect(parseFolderTemplate('01 Contracts\n02 Drawings / Architectural\n\n02 drawings/architectural\n  03 Photos  ')).toEqual([
      ['01 Contracts'], ['02 Drawings', 'Architectural'], ['03 Photos'],
    ]);
  });

  function setup(template = '') {
    const files = table([
      { id: 'f1', projectId: 7, name: 'Plan.pdf', folderPath: [], driveId: 'd1', groupId: 'g' },
      { id: 'f2', projectId: 7, name: 'Plan.pdf', folderPath: [], driveId: 'd2', groupId: 'g', isLatest: false },
      { id: 'f3', projectId: 7, name: 'Survey.dwg', folderPath: [], driveId: 'd3' },
      { id: 'f4', projectId: 7, name: 'Photo.jpg', folderPath: ['Photos'], driveId: 'd4' },
    ]);
    const folders = table();
    const projects = table([{ id: 7, name: 'Chelliah' }]);
    const google = {
      isConnected: jest.fn(async () => true),
      folderForPath: jest.fn(async (_root: string, segs: string[]) => 'folder:' + segs.join('/')),
      updateDriveFile: jest.fn(async () => undefined),
      shareLink: jest.fn(async (driveId: string) => `https://drive.test/${driveId}`),
      sendMail: jest.fn(async () => undefined),
    };
    const settings = { get: jest.fn(async () => template) };
    const svc = new FileRoomService(files as any, folders as any, projects as any, google as any, settings as any);
    return { svc, files, folders, google };
  }

  it('moves a file and its revisions, in Drive too, and records the folder', async () => {
    const { svc, files, folders, google } = setup();
    await svc.move('f1', ['Drawings', 'Permit set']);
    expect(google.updateDriveFile).toHaveBeenCalledWith('d1', { folderId: 'folder:Chelliah/Drawings/Permit set' });
    expect(google.updateDriveFile).toHaveBeenCalledWith('d2', { folderId: 'folder:Chelliah/Drawings/Permit set' });
    expect(files.rows.filter((f) => f.groupId === 'g').every((f) => f.folderPath.join('/') === 'Drawings/Permit set')).toBe(true);
    expect(folders.rows.map((f) => f.path.join('/'))).toEqual(['Drawings', 'Drawings/Permit set']);
  });

  it('lays out the standard folders, parents included, without duplicates', async () => {
    const { svc, folders, google } = setup('Contracts\nDrawings/Architectural\nDrawings/Structural');
    await svc.applyTemplate(7);
    await svc.applyTemplate(7);
    expect(folders.rows.map((f) => f.path.join('/')).sort()).toEqual(['Contracts', 'Drawings', 'Drawings/Architectural', 'Drawings/Structural']);
    expect(google.folderForPath).toHaveBeenCalledWith(expect.any(String), ['Chelliah', 'Drawings', 'Structural']);
  });

  it('moves several files at once, versions together, skipping ones already there', async () => {
    const { svc, files, google } = setup();
    expect(await svc.moveMany(['f1', 'f2', 'f3', 'f4'], ['Photos'])).toEqual({ moved: 2 });
    expect(google.updateDriveFile).toHaveBeenCalledTimes(3); // d1, d2 (versions) and d3; d4 was already there
    expect(files.rows.every((f) => f.folderPath.join('/') === 'Photos')).toBe(true);
  });

  it('emails several files as one message with every link', async () => {
    const { svc, google } = setup();
    expect(await svc.emailMany(['f1', 'f3', 'f3'], 'client@x.com', 'For Thursday', { name: 'Astrid' } as any)).toMatchObject({ sent: true, count: 2 });
    expect(google.sendMail).toHaveBeenCalledTimes(1);
    const mail = (google.sendMail.mock.calls[0] as any)[0];
    expect(mail.subject).toBe('2 files — shared from Origami');
    expect(mail.html).toContain('https://drive.test/d1');
    expect(mail.html).toContain('https://drive.test/d3');
  });
});
