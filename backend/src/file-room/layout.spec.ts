import { FileRoomService, missingFolders } from './file-room.service';
import { DEFAULT_FOLDER_TEMPLATE, isPhoto, photoPlace } from './layout';
import { ProjectTasksService } from '../project-tasks/project-tasks.service';

describe('File Room default layout (Batch 6)', () => {
  it('the default template: base sets and markups under drawings, task and FOR RECORD photos', () => {
    expect(DEFAULT_FOLDER_TEMPLATE.split('\n')).toEqual(['Drawings & Plans/Base sets', 'Drawings & Plans/Markups', 'Photos/Tasks', 'Photos/FOR RECORD']);
  });

  it('lists only the folders a project lacks, parents first, ignoring case', () => {
    const t = [['Drawings & Plans', 'Base sets'], ['Photos', 'Tasks'], ['Photos', 'FOR RECORD']];
    expect(missingFolders(t, [['photos'], ['Photos', 'Tasks']])).toEqual([['Drawings & Plans'], ['Drawings & Plans', 'Base sets'], ['Photos', 'FOR RECORD']]);
    expect(missingFolders(t, [['Drawings & Plans'], ['Drawings & Plans', 'Base sets'], ['Photos'], ['Photos', 'Tasks'], ['Photos', 'FOR RECORD']])).toEqual([]);
  });

  const table = (rows: any[]) => ({ rows, find: async () => rows.slice(), findOneBy: async (w: any) => rows.find((r) => Object.entries(w).every(([k, v]) => r[k] === v)) || null, create: (x: any) => x, save: async (x: any) => { rows.push(x); return x; } });

  it('preview: open projects missing template folders (closed ones left out); apply lays them out', async () => {
    const folders = table([{ id: 'a', projectId: 1, path: ['Drawings & Plans'] }]);
    const projects = table([{ id: 1, name: 'Kalani', stage: 'Construction' }, { id: 2, name: 'Old', stage: 'Closed' }]);
    const google = { isConnected: async () => true, folderForPath: async () => 'x' };
    const svc = new FileRoomService(table([]) as any, folders as any, projects as any, google as any, { get: async () => '' } as any, table([]) as any);
    const p = await svc.templatePreview();
    expect(p.projects.map((r) => r.name)).toEqual(['Kalani']);
    expect(p.projects[0].missing).toEqual(['Drawings & Plans / Base sets', 'Drawings & Plans / Markups', 'Photos', 'Photos / Tasks', 'Photos / FOR RECORD']);
    const r = await svc.templateApplyAll();
    expect(r).toMatchObject({ projects: 1, created: 5, failed: [] });
    expect((await svc.templatePreview()).projects).toEqual([]);
  });

  it('task photos on a project go to its File Room photos; other files as before', async () => {
    expect(isPhoto({ mimetype: 'image/jpeg' })).toBe(true);
    expect(isPhoto({ mimetype: 'application/octet-stream', originalname: 'IMG_2.HEIC' })).toBe(true);
    expect(isPhoto({ mimetype: 'application/pdf', originalname: 'a.pdf' })).toBe(false);
    expect(photoPlace('Kalani', true)).toEqual({ root: 'Origami File Room', path: ['Kalani', 'Photos', 'FOR RECORD'] });
    const calls: any[] = [];
    const svc = Object.create(ProjectTasksService.prototype) as any;
    svc.projects = { findOneBy: async () => ({ id: 4, name: 'Kalani' }) };
    svc.attachments = { assertCount: () => undefined, upload: async (files: any[], scope: string, _a: any, place?: any) => { calls.push([files.map((f) => f.originalname), scope, place?.path || null]); return files.map((f) => ({ name: f.originalname })); } };
    const out = await svc.uploadSorted([{ originalname: 'IMG_1.jpg', mimetype: 'image/jpeg' }, { originalname: 'quote.pdf', mimetype: 'application/pdf' }], 'Project 4', { name: 'Ed' }, 4);
    expect(calls).toEqual([[['IMG_1.jpg'], 'Project 4', ['Kalani', 'Photos', 'Tasks']], [['quote.pdf'], 'Project 4', null]]);
    expect(out).toHaveLength(2);
  });
});
