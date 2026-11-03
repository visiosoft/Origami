import { FileRoomService, nextRev, BACKUP_FOLDER } from './file-room.service';

describe('backups of record (Oct 30 sync)', () => {
  it('numbers revisions per document name', () => {
    expect(nextRev([], 'Cole Valley - Project Program')).toBe(1);
    expect(nextRev(['Cole Valley - Project Program REV1.pdf', 'cole valley - project program REV3.pdf', 'Other REV9.pdf'], 'Cole Valley - Project Program')).toBe(4);
    expect(nextRev(['CT-2026-0004 (Lee) REV1.pdf'], 'CT-2026-0004 (Lee)')).toBe(2);
  });
  it('files the PDF as the next REV in the project’s Backups of record folder', async () => {
    const rows = [{ id: 'F1', projectId: 3, name: 'CT-0004 Owner agreement REV1.pdf', folderPath: [BACKUP_FOLDER] }, { id: 'F2', projectId: 3, name: 'CT-0004 Owner agreement REV5.pdf', folderPath: ['Contracts'] }];
    const svc = Object.create(FileRoomService.prototype) as FileRoomService;
    (svc as any).files = { find: async () => rows };
    const upload = jest.fn(async () => [{ id: 'F9' }]);
    (svc as any).upload = upload;
    const r = await svc.saveBackupOfRecord(3, 'CT-0004 Owner agreement', Buffer.from('%PDF'), { name: 'Ed' } as any);
    expect(r).toEqual({ id: 'F9', name: 'CT-0004 Owner agreement REV2.pdf', rev: 2 });
    expect(upload).toHaveBeenCalledWith(3, [BACKUP_FOLDER], [expect.objectContaining({ originalname: 'CT-0004 Owner agreement REV2.pdf', mimetype: 'application/pdf' })], { name: 'Ed' });
  });
});
