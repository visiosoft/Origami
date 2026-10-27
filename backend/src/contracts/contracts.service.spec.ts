import { ContractsService } from './contracts.service';
import { DEFAULT_TEMPLATES } from './contract-types';

const table = (rows: any[]) => ({
  rows,
  find: jest.fn(async (o?: any) => rows.filter((r) => !o?.where || Object.entries(o.where).every(([k, v]) => r[k] === v))),
  findOneBy: jest.fn(async (w: any) => rows.find((r) => Object.entries(w).every(([k, v]) => r[k] === v)) || null),
  save: jest.fn(async (x: any) => { for (const r of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((y) => y.id === r.id); if (i >= 0) rows[i] = r; else rows.push(r); } return x; }),
  create: (x: any) => x,
  remove: jest.fn(async (x: any) => { rows.splice(rows.indexOf(x), 1); }),
  count: jest.fn(async () => rows.length),
}) as any;

function setup() {
  const contracts = table([]);
  const templates = table([{ id: 'TPL-co', type: 'co_owner', name: 'CO', html: DEFAULT_TEMPLATES.co_owner.html, isDefault: true }]);
  const projects = table([{ id: 4, name: 'Narvaes Residence', location: '91 Kuhina St', scope: 'Remodel', leadId: 'L1' }]);
  const leads = table([{ id: 'L1', leadName: 'Kai Lono', email: 'kai@x.test' }]);
  const cos = table([{ id: 'CO1', number: 'CO-003', title: 'Lanai lighting', description: 'Add 6 fixtures', amount: 4200 }]);
  const settings = { getMany: jest.fn(async () => ({ 'brand.companyName': 'Origami Design + Build', 'brand.address': '1 Main St' })), get: jest.fn(async () => 'CSLB 1'), jwtSecret: jest.fn(async () => 's3cret'), baseUrl: jest.fn(async () => 'https://odin.test') } as any;
  const mails: any[] = [];
  const google = { isConnected: jest.fn(async () => true), sendMail: jest.fn(async (m: any) => { mails.push(m); }), htmlToPdf: jest.fn(async () => Buffer.from('%PDF')) } as any;
  const uploads: any[] = [];
  const fileRoom = { upload: jest.fn(async (...a: any[]) => { uploads.push(a); return [{ id: 'fr-1' }]; }), content: jest.fn() } as any;
  const acts: any[] = [];
  const changeOrders = { act: jest.fn(async (...a: any[]) => { acts.push(a); }) } as any;
  const svc = new ContractsService(contracts, templates, projects, leads, table([]), cos, table([]), table([]), settings, google, fileRoom, changeOrders);
  return { svc, contracts, mails, uploads, acts };
}
const sig = { name: 'Kai Lono', initials: 'kl', image: 'data:image/png;base64,AAA', reviewed: true };

describe('ContractsService', () => {
  it('drafts from the template, merged with the project, owner and change order, with Origami as the last signer', async () => {
    const { svc } = setup();
    const c = await svc.create({ type: 'co_owner', projectId: 4, changeOrderId: 'CO1', parties: [{ role: 'owner', label: 'Owner', name: 'Kai Lono', email: 'Kai@X.test' }] }, { name: 'Edward', email: 'e@o.test' });
    expect(c.number).toMatch(/^CT-\d{4}-0001$/);
    expect(c.html).toContain('Change Order CO-003');
    expect(c.html).toContain('Lanai lighting — Add 6 fixtures');
    expect(c.html).toContain('$4,200');
    expect(c.parties.map((p: any) => [p.role, p.internal || false, p.email])).toEqual([['owner', false, 'kai@x.test'], ['origami', true, 'e@o.test']]);
    expect(c.status).toBe('draft');
  });

  it('sends each outside signer their own link; they initial every section and sign; Origami counter-signs; the PDF is filed and the change order approved', async () => {
    const { svc, contracts, mails, uploads, acts } = setup();
    const c = await svc.create({ type: 'co_owner', projectId: 4, changeOrderId: 'CO1', parties: [{ role: 'owner', label: 'Owner', name: 'Kai Lono', email: 'kai@x.test' }] }, { name: 'Edward', email: 'e@o.test' });
    await svc.send(c.id, {}, { name: 'Edward' });
    expect(mails).toHaveLength(1);
    const token = decodeURIComponent(/token=([^"]+)/.exec(mails[0].html)![1]);
    const view = await svc.publicView(token);
    expect(view).toMatchObject({ number: c.number, initialsNeeded: 3, you: { label: 'Owner', suggestedInitials: 'KL' } });
    await expect(svc.publicSign(token, { ...sig, initialled: 2 }, {})).rejects.toThrow('Initial all 3 sections');
    await expect(svc.publicSign(token, { ...sig, initialled: 3, reviewed: false }, {})).rejects.toThrow('Confirm you have read');
    await expect(svc.countersign(c.id, { ...sig, initialled: 3 }, { name: 'Edward' }, {})).rejects.toThrow('Origami signs once everyone else has');
    await svc.publicSign(token, { ...sig, initialled: 3 }, { ip: '1.2.3.4' });
    expect(contracts.rows[0].status).toBe('countersign');
    expect(contracts.rows[0].parties[0]).toMatchObject({ signedName: 'Kai Lono', initials: 'KL', ip: '1.2.3.4' });
    await expect(svc.publicSign(token, { ...sig, initialled: 3 }, {})).rejects.toThrow('already signed');
    await svc.countersign(c.id, { ...sig, name: 'Edward M', initials: 'EM', initialled: 3 }, { name: 'Edward', id: 'U-1', roleKey: 'admin' }, {});
    expect(contracts.rows[0]).toMatchObject({ status: 'signed', signedFileId: 'fr-1' });
    expect(uploads[0][0]).toBe(4);
    expect(uploads[0][1]).toEqual(['Contracts']);
    expect(uploads[0][2][0].originalname).toMatch(/\(signed\)\.pdf$/);
    expect(acts[0]).toEqual(['CO1', 'client_approve', expect.objectContaining({ signer: 'Kai Lono', reference: expect.stringContaining(c.number) }), expect.objectContaining({ name: 'Edward' })]);
  });

  it('will not send with unfilled fields or a signer without an email; only drafts are edited or deleted', async () => {
    const { svc } = setup();
    const c = await svc.create({ type: 'co_owner', projectId: 4, parties: [{ role: 'owner', label: 'Owner', name: 'Kai', email: '' }] }, { name: 'Edward' });
    await expect(svc.send(c.id, {}, {})).rejects.toThrow('Fill in {{changeOrder.number}}');
    await svc.update(c.id, { html: '<p>Simple {{initials}}</p>' });
    await expect(svc.send(c.id, {}, {})).rejects.toThrow('Owner needs a name and an email');
    await svc.update(c.id, { parties: [{ role: 'owner', label: 'Owner', name: 'Kai', email: 'k@x.test' }, { role: 'origami', label: 'Origami', name: 'E', email: 'e@x.test', internal: true }] });
    await svc.send(c.id, {}, {});
    await expect(svc.update(c.id, { title: 'x' })).rejects.toThrow('Only a draft');
    await expect(svc.remove(c.id)).rejects.toThrow('voided, not deleted');
    await expect(svc.void(c.id, '')).rejects.toThrow('Say why');
    expect((await svc.void(c.id, 'Wrong amount')).status).toBe('void');
  });
});
