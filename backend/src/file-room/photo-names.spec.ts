import { FileRoomService, freeName, isImageUpload } from './file-room.service';

/** Nov 3 sync: phones name every photo "image.jpg"; they were being chained as versions and hidden. */
describe('photo uploads', () => {
  it('gives a same-name photo its own name', () => {
    expect(freeName('image.jpg', [])).toBe('image.jpg');
    expect(freeName('image.jpg', ['IMAGE.jpg', 'image (2).jpg'])).toBe('image (3).jpg');
    expect(freeName('README', ['readme'])).toBe('README (2)');
    expect(isImageUpload({ originalname: 'IMG_1.HEIC', mimetype: 'application/octet-stream' })).toBe(true);
    expect(isImageUpload({ originalname: 'A-201.pdf', mimetype: 'application/pdf' })).toBe(false);
  });

  it('never makes a photo a version of another; a PDF still is', async () => {
    const rows: any[] = [{ id: 'old', projectId: 3, folderPath: ['Daily Reports', '2026-11-03'], name: 'image.jpg', groupId: null, isLatest: true }, { id: 'pdf', projectId: 3, folderPath: ['Drawings'], name: 'A-201.pdf', groupId: null, isLatest: true }];
    const svc = Object.create(FileRoomService.prototype) as any;
    svc.log = { log: () => undefined };
    svc.files = { find: async () => rows, update: jest.fn(async () => undefined), create: (x: any) => x, save: async (x: any) => { rows.push(x); return x; } };
    svc.google = { isConnected: async () => true, folderForPath: async () => 'FOLDER', uploadDriveFile: async (o: any) => ({ id: 'D-' + o.name, size: '10', mimeType: 'x' }) };
    svc.projectName = async () => 'Cole Valley';
    svc.assertAllowed = () => undefined;
    svc.hydrate = (f: any) => f;
    const [p] = await svc.upload(3, ['Daily Reports', '2026-11-03'], [{ originalname: 'image.jpg', mimetype: 'image/jpeg', size: 10, buffer: Buffer.from('') }], { name: 'George' });
    expect(p.name).toBe('image (2).jpg');
    expect(p.groupId).toBeUndefined();
    expect(svc.files.update).not.toHaveBeenCalled();
    const [d] = await svc.upload(3, ['Drawings'], [{ originalname: 'A-201.pdf', mimetype: 'application/pdf', size: 10, buffer: Buffer.from('') }], { name: 'Ed' });
    expect(d.name).toBe('A-201.pdf');
    expect(d.groupId).toBeTruthy();
  });
});
