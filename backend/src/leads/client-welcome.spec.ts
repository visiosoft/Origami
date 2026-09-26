import { ClientWelcomeService, intakeSummary } from './client-welcome.service';

function setup() {
  const fileRows: any[] = [];
  const files = {
    findOneBy: async (w: any) => fileRows.find((r) => r.leadId === w.leadId) ?? null,
    create: (x: any) => ({ ...x }),
    save: async (r: any) => { const i = fileRows.findIndex((x) => x.leadId === r.leadId); if (i >= 0) fileRows[i] = r; else fileRows.push(r); return r; },
  };
  const lead = {
    id: 'PL-7', leadName: 'Aquino Kitchen', firstName: 'Maria', lastName: 'Aquino', goByName: '', email: 'maria@client.test',
    projectStreetAddress: '44', projectStreetName: 'Elm Ave', projectCity: 'Tracy', projectZipCode: '95376',
    propertyType: 'Single family', potentialProjectType: 'Kitchen remodel', contractType: 'N/A', projectVision: 'Open the wall <b>between</b> kitchen and dining.',
    homeworkCompleted: ['As-Builts', 'Survey'],
  };
  const leads = { findOneBy: async () => lead };
  const users = { findOneBy: async ({ id }: any) => (id === 'u1' ? { id: 'u1', email: 'astrid@origami.test' } : null) };
  const uploaded: any[] = [];
  const attachments = { upload: async (fs: any[]) => fs.map((f, i) => { const a = { id: 'a' + (uploaded.length + i), name: f.originalname, kind: 'drive', uploadedAt: '2026-09-26T10:00:00Z' }; uploaded.push(a); return a; }) };
  const sent: any[] = [];
  const google = { isConnected: async () => true, sendMail: async (m: any) => { sent.push(m); return {}; } };
  const settings = { jwtSecret: async () => 'test-secret', baseUrl: async () => 'https://app.test', getMany: async () => ({}), get: async () => '' };
  const service = new ClientWelcomeService(files as any, leads as any, users as any, attachments as any, google as any, settings as any);
  return { service, sent, fileRows };
}
const actor = { id: 'u1', name: 'Astrid Rivas' };
const tokenOf = (url: string) => decodeURIComponent(url.split('token=')[1]);

describe('client welcome email + upload link (F11)', () => {
  it('thanks them, sums up what they said, lists the homework, and links to a private upload page', async () => {
    const { service, sent } = setup();
    const out = await service.send('PL-7', { note: '' }, actor);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'maria@client.test', replyTo: 'astrid@origami.test', subject: 'Thank you — next steps for Aquino Kitchen' });
    expect(sent[0].html).toContain('Hi Maria,');
    expect(sent[0].html).toContain('44 Elm Ave, Tracy, 95376');
    expect(sent[0].html).toContain('Kitchen remodel');
    expect(sent[0].html).not.toContain('N/A');
    expect(sent[0].html).toContain('&lt;b&gt;between&lt;/b&gt;');
    expect(sent[0].html).toContain('<li>As-Builts</li>');
    expect(out.url).toMatch(/^https:\/\/app\.test\/upload\?token=/);
    expect(out).toMatchObject({ linkLive: true, sentTo: 'maria@client.test', sentBy: 'Astrid Rivas', items: ['As-Builts', 'Survey'] });
  });

  it('the page shows the project and what was asked for; uploads are filed under the item', async () => {
    const { service, fileRows } = setup();
    const { url } = await service.send('PL-7', {}, actor);
    const view = await service.publicView(tokenOf(url));
    expect(view).toMatchObject({ project: 'Aquino Kitchen', firstName: 'Maria', items: ['As-Builts', 'Survey'], uploaded: [] });
    const after = await service.publicUpload(tokenOf(url), [{ originalname: 'survey.pdf' }], 'Survey');
    expect(after.uploaded).toEqual([{ name: 'survey.pdf', item: 'Survey', at: '2026-09-26T10:00:00Z' }]);
    expect(fileRows[0].attachments[0]).toMatchObject({ stage: 'client_upload', stageName: 'Client: Survey' });
  });

  it('a new email or turning the link off retires older links; a tampered token is refused', async () => {
    const { service } = setup();
    const first = await service.send('PL-7', {}, actor);
    const second = await service.send('PL-7', {}, actor);
    await expect(service.publicView(tokenOf(first.url))).rejects.toThrow('replaced or turned off');
    await expect(service.publicView(tokenOf(second.url))).resolves.toBeTruthy();
    await service.disable('PL-7');
    await expect(service.publicView(tokenOf(second.url))).rejects.toThrow('replaced or turned off');
    await expect(service.publicView('abc.def')).rejects.toThrow('isn’t valid');
  });

  it('won’t send without an email address', async () => {
    const { service } = setup();
    await expect(service.send('PL-7', { to: 'nope' }, actor)).rejects.toThrow('email');
  });

  it('the summary leaves out blanks and N/A', () => {
    expect(intakeSummary({ leadName: 'X', contractType: 'n/a', propertyType: '' } as any)).toEqual([['Project', 'X']]);
  });
});
