import { ChangeOrdersService } from './change-orders.service';
import { changeOrderHtml } from './co.document';

function setup(opts: { status?: string; billToEmail?: string; canApprove?: boolean } = {}) {
  const co: any = { id: 'CO-a', projectId: 23, number: 'CO-003', title: 'Upgrade to quartz counters', status: opts.status ?? 'submitted', reason: 'client_request', scheduleImpactDays: 2, createdAt: '2026-09-20T10:00:00Z', attachments: [], version: 3 };
  const items = [{ id: 'i1', changeOrderId: 'CO-a', lineOrder: 1, description: 'Quartz, 42 sq ft', amount: 3150, cost: 2400 }];
  const cos = { findOneBy: async () => co, save: async (x: any) => x };
  const itemRepo = { find: async () => items, count: async () => items.length };
  const logged: any[] = [];
  const approvals: any[] = [];
  const fin: any = {
    need: async (_a: any, right: string) => { if (right === 'approveChangeOrders' && opts.canApprove === false) throw new Error("Your role doesn't allow that"); },
    settingsFor: async () => ({ value: { billToName: 'Maria Aquino', billToEmail: opts.billToEmail ?? 'maria@client.test' } }),
    project: async () => ({ id: 23, name: "Aquino's Kitchen and Bathroom Remodel" }),
    brand: async () => ({ companyName: 'Origami Design + Build', accentColor: '#173326' }),
    approval: async (_m: any, e: any) => { approvals.push(e); },
    approvalsFor: async () => approvals,
    log: async (_m: any, e: any) => { logged.push(e); },
  };
  const sent: any[] = [];
  const google = { isConnected: async () => true, htmlToPdf: async () => Buffer.from('%PDF'), sendMail: async (m: any) => { sent.push(m); return {}; } };
  const settings = { get: async () => '', getMany: async () => ({}) };
  const service = new ChangeOrdersService(cos as any, itemRepo as any, {} as any, {} as any, {} as any, fin, undefined, google as any, settings as any);
  return { service, sent, approvals, logged };
}

const actor = { id: 'u1', name: 'Astrid Rivas', roleKey: 'admin' };

describe('change order to the client', () => {
  it('emails the bill-to contact with the PDF and records it on the approval trail', async () => {
    const { service, sent, approvals, logged } = setup();
    await service.act('CO-a', 'email_client', { version: 3, note: 'As discussed on site.', cc: 'pm@origami.test' }, actor);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'maria@client.test', cc: 'pm@origami.test', subject: "Change order CO-003 for your signature — Aquino's Kitchen and Bathroom Remodel" });
    expect(sent[0].attachments[0]).toMatchObject({ filename: 'CO-003.pdf', mimeType: 'application/pdf' });
    expect(sent[0].html).toContain('$3,150.00');
    expect(sent[0].html).toContain('As discussed on site.');
    expect(approvals[0]).toMatchObject({ decision: 'sent_to_client', comment: 'Emailed to maria@client.test, cc pm@origami.test · As discussed on site.' });
    expect(logged[0].action).toBe('co_emailed');
  });

  it('another address can be given; a missing or junk address is refused', async () => {
    const a = setup({ billToEmail: '' });
    await expect(a.service.act('CO-a', 'email_client', { version: 3 }, actor)).rejects.toThrow('email address');
    await a.service.act('CO-a', 'email_client', { version: 3, to: 'owner@client.test' }, actor);
    expect(a.sent[0].to).toBe('owner@client.test');
    await expect(setup().service.act('CO-a', 'email_client', { version: 3, to: 'x@y.co\r\nBcc: z@evil.test' }, actor)).rejects.toThrow('email address');
  });

  it('only while it is under client review, and only for approvers', async () => {
    await expect(setup({ status: 'draft' }).service.act('CO-a', 'email_client', { version: 3 }, actor)).rejects.toThrow('under client review');
    await expect(setup({ canApprove: false }).service.act('CO-a', 'email_client', { version: 3 }, actor)).rejects.toThrow("doesn't allow");
  });

  it('the document escapes what people typed and shows the signature blocks', () => {
    const html = changeOrderHtml({ number: 'CO-1', title: '<b>x</b>', total: 10, items: [{ description: 'a & b', amount: 10 }] }, { companyName: 'Origami', logoDataUrl: 'javascript:alert(1)' }, 'P');
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('a &amp; b');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('Client signature, name &amp; date');
  });
});
