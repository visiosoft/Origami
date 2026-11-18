import { signState } from '../auth/crypto.util';
import { bundleHtml, cleanDecisions, coItem } from './bundle';
import { ClientApprovalsService } from './client-approvals.service';

/** Nov 17 (Edward): bundle RFIs, decisions and change orders for the client to approve and sign once. */
describe('client approval bundles', () => {
  const SECRET = 'test-secret';
  const store: any = { rows: [] as any[] };
  const repo = {
    create: (x: any) => x,
    save: async (x: any) => { const i = store.rows.findIndex((r: any) => r.id === x.id); if (i >= 0) store.rows[i] = x; else store.rows.push(x); return x; },
    find: async (o?: any) => store.rows.filter((r: any) => !o?.where?.projectId || r.projectId === o.where.projectId),
    findOneBy: async (w: any) => store.rows.find((r: any) => r.id === w.id) || null,
  };
  const rfis = [{ id: 'R1', number: 'RFI-007', subject: 'Beam at grid C', question: 'Size?', answer: 'W12x26', projectId: 7, status: 'answered', history: [] as any[] }];
  const log: any[] = [{ id: 'L1', serial: 'FR-001', topicType: 'Decision', subject: 'Tile: Warm Gray', description: 'Client picked Warm Gray grout', project: 'Countryside', activity: [] as any[] }, { id: 'L2', topicType: 'Task', subject: 'Not for record', project: 'Countryside' }];
  const cos = [{ id: 'C1', number: 'CO-003', title: 'ADU deck', amount: 25000, status: 'submitted', projectId: 7 }];
  const acts: any[] = []; const uploads: any[] = []; const mails: any[] = [];
  const svc = new ClientApprovalsService(
    repo as any,
    { findOneBy: async () => ({ id: 7, name: 'Countryside' }) } as any,
    { find: async () => rfis, findOneBy: async (w: any) => rfis.find((r) => r.id === w.id), save: async (x: any) => x } as any,
    { find: async () => log, findOneBy: async (w: any) => log.find((r) => r.id === w.id), save: async (x: any) => x } as any,
    { find: async () => cos, findOneBy: async (w: any) => cos.find((r) => r.id === w.id) } as any,
    { jwtSecret: async () => SECRET, baseUrl: async () => 'https://staging.test', get: async () => null, getMany: async () => ({}) } as any,
    { isConnected: async () => true, sendMail: async (m: any) => { mails.push(m); }, htmlToPdf: async () => Buffer.from('%PDF') } as any,
    { settingsFor: async () => ({ value: { billToEmail: 'kai@lono.test', billToName: 'Kai Lono' } }) } as any,
    { act: async (...a: any[]) => { acts.push(a); } } as any,
    { upload: async (pid: number, folder: string[], files: any[]) => { uploads.push({ pid, folder, name: files[0].originalname }); return [{ id: 'F9' }]; } } as any,
  );

  it('offers RFIs, FOR RECORD entries and change orders with the client', async () => {
    const c = await svc.candidates(7);
    expect(c.rfis.map((i) => i.label)).toEqual(['RFI-007 — Beam at grid C']);
    expect(c.records.map((i) => i.id)).toEqual(['L1']);
    expect(c.changeOrders[0].label).toBe('CO-003 — ADU deck · $25,000.00');
    expect(c.clientEmail).toBe('kai@lono.test');
  });

  it('sends one link, then the client approves and declines item by item and signs once', async () => {
    const b = await svc.create(7, { title: 'Week 46 decisions', items: [{ kind: 'rfi', id: 'R1' }, { kind: 'record', id: 'L1' }, { kind: 'co', id: 'C1' }, { kind: 'co', id: 'nope' }] }, { name: 'Ehsan' });
    expect(b.number).toBe('AP-001');
    expect(b.items).toHaveLength(3);
    const sent = await svc.send(b.id, {}, { name: 'Ehsan' });
    expect(sent.to).toBe('kai@lono.test');
    expect(mails[0].html).toContain('Review and sign');
    const token = signState({ mode: 'bundle-sign', bundleId: b.id }, SECRET);
    const view = await svc.publicView(token);
    expect(view.items.map((i) => i.kind)).toEqual(['rfi', 'record', 'co']);
    const decisions = { 'rfi:R1': { decision: 'approved' }, 'record:L1': { decision: 'approved' }, 'co:C1': { decision: 'declined' } };
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    await expect(svc.publicSign(token, { decisions, name: 'Kai Lono', image: png, agree: true }, {})).rejects.toThrow(/Say why you’re declining/);
    await expect(svc.publicSign(token, { decisions: { 'rfi:R1': { decision: 'approved' } }, name: 'Kai Lono', image: png, agree: true }, {})).rejects.toThrow(/Approve or decline/);
    (decisions as any)['co:C1'].note = 'Over budget';
    await svc.publicSign(token, { decisions, name: 'Kai Lono', image: png, agree: true }, { ip: '1.2.3.4' });
    const row = store.rows[0];
    expect(row.status).toBe('signed');
    await svc.afterSigned(row);
    expect(rfis[0].history.at(-1)).toMatchObject({ action: 'client approved' });
    expect(log[0].activity.at(-1).text).toBe('Approved by the client in AP-001');
    expect(acts[0][1]).toBe('reject');
    expect(acts[0][2].comment).toBe('Declined by the client in AP-001 — Over budget');
    expect(uploads[0]).toMatchObject({ pid: 7, folder: ['Approvals'], name: 'AP-001 Week 46 decisions (signed).pdf' });
    await expect(svc.publicSign(token, { decisions, name: 'Kai Lono', image: png, agree: true }, {})).rejects.toThrow(/already been signed/);
  });

  it('approved change orders are recorded as client-approved', () => {
    expect(cleanDecisions([coItem(cos[0])], { 'co:C1': { decision: 'approved' } })[0].decision).toBe('approved');
  });

  it('the signed PDF lists each decision and the signature', () => {
    const html = bundleHtml({ number: 'AP-001', title: 'T', items: [{ ...coItem(cos[0]), decision: 'declined', note: 'Over <budget>' }], signedName: 'Kai', signedAt: '2026-11-18T10:00:00Z', signatureImage: 'data:image/png;base64,AAAA' }, 'Countryside', 'Origami');
    expect(html).toContain('Declined');
    expect(html).toContain('Over &lt;budget&gt;');
    expect(html).toContain('<img src="data:image/png;base64,AAAA"');
  });
});
