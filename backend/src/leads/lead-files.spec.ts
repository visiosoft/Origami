import { LeadFilesService } from './lead-files.service';

function setup() {
  const rows: any[] = [];
  const repo = {
    findOneBy: async (w: any) => rows.find((r) => r.leadId === w.leadId) ?? null,
    create: (x: any) => ({ ...x }),
    save: async (r: any) => { const i = rows.findIndex((x) => x.leadId === r.leadId); if (i >= 0) rows[i] = r; else rows.push(r); return r; },
  };
  const leads = { findOneBy: async () => ({ id: 'PL-7', leadName: 'Joel Rodriguez' }) };
  const uploads: string[] = [];
  const discarded: string[] = [];
  const attachments = {
    upload: async (files: any[], folder: string) => { uploads.push(folder); return files.map((f, i) => ({ id: `att-${i}`, name: f.originalname, kind: 'drive', driveId: `d${i}` })); },
    discard: async (a: any) => { discarded.push(a.id); },
  };
  return { service: new LeadFilesService(repo as any, leads as any, attachments as any), rows, uploads, discarded };
}

const actor = { id: 'u1', name: 'Astrid Rivas' };

describe('lead files', () => {
  it('tags uploads with the stage they were added in, in a Drive folder named after the lead', async () => {
    const { service, uploads } = setup();
    const out = await service.addAttachments('PL-7', [{ originalname: 'site-1.jpg' }], actor, 'site_visit', 'Schedule Site Visit');
    expect(out[0]).toMatchObject({ name: 'site-1.jpg', stage: 'site_visit', stageName: 'Schedule Site Visit' });
    expect(uploads[0]).toBe('Lead PL-7 - Joel Rodriguez');
  });

  it('links and untagged files sit alongside; removing one discards it from Drive', async () => {
    const { service, discarded } = setup();
    await service.addAttachments('PL-7', [{ originalname: 'survey.pdf' }], actor);
    await service.addLink('PL-7', 'Zillow listing', 'https://zillow.test/x', actor, 'initial_questions', 'Initial Questions');
    const all = await service.list('PL-7');
    expect(all.map((a) => [a.name, a.stage ?? null])).toEqual([['survey.pdf', null], ['Zillow listing', 'initial_questions']]);
    await service.removeAttachment('PL-7', all[0].id);
    expect(discarded).toEqual([all[0].id]);
    expect((await service.list('PL-7')).map((a) => a.name)).toEqual(['Zillow listing']);
  });

  it('a lead with no files lists empty', async () => {
    expect(await setup().service.list('PL-none')).toEqual([]);
  });
});
