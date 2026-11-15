import { backupSubfolder } from '../backup/project-sheet.service';
import { cleanAutoFor, matchesAuto, withAutoChecklists } from './auto-checklist';
import { ChecklistTemplatesService } from './checklist-templates.service';

const roughIn = { id: 'CLT-RI', name: 'Plumbing rough-in QA', kind: 'qaqc', items: [{ item: 'Pressure test 15 min' }, { item: 'Photos before cover' }], autoFor: ['programme:ca-site-inspections', 'label:Inspection'] };

describe('QA/QC checklists (Nov 13)', () => {
  it('a template can be tied to a programme task', () => {
    expect(cleanAutoFor(['programme:co-04', 'nope:x', 'label:Milestone'])).toEqual(['programme:co-04', 'label:Milestone']);
    expect(matchesAuto(['programme:co-04'], { kind: 'task', programmeId: 'co-04' })).toBe(true);
    expect(matchesAuto(['programme:co-04'], { kind: 'task', programmeId: 'co-05' })).toBe(false);
  });

  it('items remember their template, so the QA/QC page can find them', () => {
    const out = withAutoChecklists([roughIn], { kind: 'task', programmeId: 'ca-site-inspections' }, [], 's');
    expect(out.map((c) => [c.item, c.templateId])).toEqual([['Pressure test 15 min', 'CLT-RI'], ['Photos before cover', 'CLT-RI']]);
  });

  function svc(tasks: any[], templates: any[] = [roughIn]) {
    const repo = { find: async () => templates, findOneBy: async (w: any) => templates.find((t) => t.id === w.id) || null };
    const taskRepo = { find: async () => tasks, save: async (x: any) => x };
    return new ChecklistTemplatesService(repo as any, taskRepo as any);
  }

  it('a new QA/QC template goes onto matching open tasks that already exist (programme task or label, never every task)', async () => {
    const tasks: any[] = [
      { id: 'T-7-ca-site-inspections', projectId: 7, title: 'Site inspections', checklist: [], labels: [] },
      { id: 'T-7-other', projectId: 7, title: 'Framing', checklist: [], labels: ['Inspection'] },
      { id: 'T-8-ca-site-inspections', projectId: 8, title: 'Site inspections', checklist: [], labels: [], completed: true },
      { id: 'TK-1', projectId: 7, title: 'Hand-made', checklist: [], labels: [] },
    ];
    const n = await svc(tasks).applyToExisting({ ...roughIn, autoFor: [...roughIn.autoFor, 'task'] } as any);
    expect(n).toBe(2);
    expect(tasks.map((t) => t.checklist.length)).toEqual([2, 2, 0, 0]);
    expect(await svc(tasks).applyToExisting({ ...roughIn, kind: 'general' } as any)).toBe(0);
  });

  it('the QA/QC list: per task and template, done of total, only the caller’s projects', async () => {
    const tasks: any[] = [
      { id: 'T-7-a', projectId: 7, title: 'Rough-in', dueDate: '2026-12-01', checklist: [{ id: '1', item: 'a', done: true, templateId: 'CLT-RI' }, { id: '2', item: 'b', done: false, templateId: 'CLT-RI' }, { id: '3', item: 'x', done: false }] },
      { id: 'T-9-a', projectId: 9, title: 'Elsewhere', checklist: [{ id: '1', item: 'a', done: false, templateId: 'CLT-RI' }] },
    ];
    const rows = await svc(tasks).qaqc((id) => id === 7);
    expect(rows).toEqual([expect.objectContaining({ taskId: 'T-7-a', templateName: 'Plumbing rough-in QA', total: 2, done: 1 })]);
  });

  it('backup sheet folder: a path inside the project folder, nothing that climbs out', () => {
    expect(backupSubfolder(' Admin / Backups ')).toEqual(['Admin', 'Backups']);
    expect(backupSubfolder('../../x')).toEqual(['x']);
    expect(backupSubfolder('')).toEqual([]);
  });
});
