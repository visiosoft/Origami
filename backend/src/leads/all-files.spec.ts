import { AllFilesService } from './all-files.service';

const repo = (rows: any[]) => ({
  find: async (o?: any) => rows.filter((r) => !o?.where || Object.entries(o.where).every(([k, v]) => r[k] === v)),
  findOneBy: async (w: any) => rows.find((r) => Object.entries(w).every(([k, v]) => r[k] === v)) ?? null,
});

function setup(converted: boolean) {
  const leadFiles = [{ leadId: 'PL-7', attachments: [
    { id: 'a1', name: 'site-photo.jpg', kind: 'drive', stage: 'site_visit', stageName: 'Schedule Site Visit', uploadedAt: '2026-09-02T10:00:00Z', uploadedBy: 'Astrid' },
    { id: 'a2', name: 'survey.pdf', kind: 'drive', stage: 'client_upload', stageName: 'Client: Survey', uploadedAt: '2026-09-05T10:00:00Z', uploadedBy: 'Maria Aquino (client)' },
  ] }];
  const leads = [{ id: 'PL-7', leadName: 'Aquino Kitchen' }];
  const logTasks = [
    { id: '20260901-03', project: 'PL-7', description: 'Collect the survey\nfrom Maria', attachments: [{ id: 't1', name: 'old-survey.pdf', kind: 'drive', uploadedAt: '2026-09-01T09:00:00Z' }] },
    { id: '20260901-04', project: 'Other lead', description: 'x', attachments: [{ id: 't9', name: 'not-mine.pdf', kind: 'drive', uploadedAt: '2026-09-01T09:00:00Z' }] },
  ];
  const projects = converted ? [{ id: 23, name: 'Aquino Kitchen', leadId: 'PL-7' }] : [];
  const boardTasks = [{ id: 'T-1', projectId: 23, title: 'Order cabinets', phaseId: 'PH-1', attachments: [{ id: 'b1', name: 'cabinet-quote.pdf', kind: 'drive', uploadedAt: '2026-09-20T09:00:00Z' }] }];
  const phases = [{ id: 'PH-1', projectId: 23, name: 'Construction Administration' }];
  const rfis = [{ id: 'RFI-a', projectId: 23, number: 'RFI-001', subject: 'Header size', attachments: [{ id: 'r1', name: 'detail.png', kind: 'drive', uploadedAt: '2026-09-21T09:00:00Z' }] }];
  const rooms = [
    { id: 'F1', projectId: 23, name: 'A-101.pdf', folderPath: ['Drawings'], isLatest: true, updatedAt: '2026-09-15T09:00:00Z' },
    { id: 'F0', projectId: 23, name: 'A-101 old.pdf', folderPath: ['Drawings'], isLatest: false, updatedAt: '2026-09-10T09:00:00Z' },
  ];
  return new AllFilesService(repo(leadFiles) as any, repo(leads) as any, repo(logTasks) as any, repo(projects) as any, repo(boardTasks) as any, repo(phases) as any, repo(rfis) as any, repo(rooms) as any);
}

describe('every file on a lead / project, numbered', () => {
  it('a lead: its stage files, client uploads and task files (with the task number) -- not other leads’', async () => {
    const r = await setup(false).forLead('PL-7');
    expect(r.files.map((f) => [f.n, f.name, f.source, f.where])).toEqual([
      [3, 'survey.pdf', 'client', 'From the client · Survey'],
      [2, 'site-photo.jpg', 'lead', 'Schedule Site Visit'],
      [1, 'old-survey.pdf', 'lead-task', 'Task 20260901-03 · Collect the survey'],
    ]);
    expect(r.files[2]).toMatchObject({ taskNumber: '20260901-03', scope: 'tasks', ownerId: '20260901-03' });
  });

  it('once it’s a project: the lead’s files plus board tasks, RFIs and the File Room (latest versions)', async () => {
    const r = await setup(true).forProject(23);
    expect(r.files.map((f) => [f.n, f.name, f.source])).toEqual([
      [7, 'detail.png', 'rfi'], [6, 'cabinet-quote.pdf', 'project-task'], [5, 'A-101.pdf', 'file-room'],
      [4, 'survey.pdf', 'client'], [3, 'site-photo.jpg', 'lead'], [2, 'old-survey.pdf', 'lead-task'], [1, 'not-mine.pdf', 'lead-task'],
    ].filter(([, name]) => name !== 'not-mine.pdf').map(([n, name, s], i, arr) => [arr.length - i, name, s]));
    expect(r.files.find((f) => f.name === 'cabinet-quote.pdf')!.where).toBe('Construction Administration · Task: Order cabinets');
    expect(r.files.find((f) => f.name === 'A-101.pdf')!.where).toBe('Plan & File Room › Drawings');
  });

  it('the same list from the lead once converted', async () => {
    expect((await setup(true).forLead('PL-7')).files).toHaveLength(6);
  });
});
