import { Workbook } from 'exceljs';
import { signState } from '../auth/crypto.util';
import { computeEstimate } from './estimate.calc';
import { estimateHtml } from './estimate.document';
import { EstimateLetterService } from './estimate-letter.service';
import { moneyRightsOf } from './estimate.money';

const SECRET = 'test-secret';
const v = (on: boolean) => ({ view: on, manage: false });
const CLOSED_ROLE = { key: 'r_client_closed_book', permissions: { 'fin:line_items_amount': v(false), 'fin:subcontracted_total': v(false), 'fin:subtotal': v(true), 'fin:markups': v(false), 'fin:line_item_total': v(true), 'fin:general_requirements': v(false), 'fin:general_requirements_total': v(true), 'fin:profit': v(false), 'fin:contingency': v(false), 'fin:total_construction': v(true) } };
const OPEN_ROLE = { key: 'r_client_open_book', permissions: Object.fromEntries(Object.keys(CLOSED_ROLE.permissions).map((k) => [k, v(true)])) };

function sheet() {
  const scopes = [{ id: 's1', title: 'Demolition', csiCodeId: 'c1' }];
  const lines = [
    { id: 'l1', scopeId: 's1', kind: 'item', description: 'Demo walls', cost: 1000, markupMode: 'amt', markupAmt: 300, pricing: 'fc' },
    { id: 'l2', scopeId: 's1', kind: 'inclusion', description: 'Haul-off of debris' },
    { id: 'l3', scopeId: 's1', kind: 'exclusion', description: 'Hazardous <materials>' },
  ];
  const gr = [{ id: 'g1', title: 'Supervision', base: 500, qty: 1, included: true }];
  return { scopes, lines, gr };
}
function setup(opts: { status?: string; others?: any[]; role?: any; book?: string } = {}) {
  const sh = sheet();
  const e: any = { id: 'E1', projectId: 7, number: 'EST-001', rev: 2, title: 'Bathrooms', status: opts.status || 'sent', grPct: 17, profitPct: 12, contingencyPct: 5, showGrDetail: false, payments: [], intro: 'Thank you for the chance to bid.', terms: 'Valid 30 days.' };
  const result = computeEstimate({ settings: e, scopes: sh.scopes, lines: sh.lines as any, gr: sh.gr });
  const saved: any[] = []; const logs: any[] = []; const mails: any[] = []; const uploads: any[] = [];
  const estimates: any = {
    raw: async () => ({ e, sheet: sh, result, rights: { money: moneyRightsOf('all') } }),
    revisionsOf: async () => [e, ...(opts.others || [])],
    saveEntity: async (x: any) => { saved.push({ ...x }); return x; },
    markSent: async () => { e.status = 'sent'; },
  };
  const fin: any = { settingsFor: async () => ({ value: { bookType: opts.book || 'closed', billToName: 'Kai Lono', billToEmail: 'kai@example.test' } }), project: async () => ({ name: 'Lono house' }), log: async (_m: any, x: any) => logs.push(x) };
  const settings: any = { jwtSecret: async () => SECRET, getMany: async () => ({ 'brand.companyName': 'Origami' }), baseUrl: async () => 'https://app.test', get: async () => '' };
  const google: any = { isConnected: async () => true, htmlToPdf: async (html: string) => Buffer.from(html), sendMail: async (m: any) => mails.push(m) };
  const roles: any = { findOne: async ({ where }: any) => (opts.role !== undefined ? opts.role : where.key === OPEN_ROLE.key ? OPEN_ROLE : CLOSED_ROLE) };
  const csi: any = { find: async () => [{ id: 'c1', code: '02.41' }] };
  const users: any = { findOne: async () => ({ id: 'U1', email: 'edward@origami.test' }) };
  const fileRoom: any = { upload: async (...a: any[]) => { uploads.push(a); return [{ id: 'F1' }]; } };
  const svc = new EstimateLetterService(estimates, fin, settings, google, roles, csi, users, fileRoom);
  const token = signState({ mode: 'est-sign', estimateId: 'E1' }, SECRET);
  return { svc, e, saved, logs, mails, uploads, token };
}
const SIG = 'data:image/png;base64,iVBORw0KGgo=';

describe('K8: the estimate letter', () => {
  it('closed book shows prices and totals but no cost or markup; statements listed; text escaped', async () => {
    const { svc, token } = setup();
    const view = await svc.publicView(token);
    expect(view.canSign).toBe(true);
    expect(view.html).toContain('$1,300.00');
    expect(view.html).not.toContain('$1,000.00');
    expect(view.html).not.toContain('Markup');
    expect(view.html).toContain('Haul-off of debris');
    expect(view.html).toContain('Hazardous &lt;materials&gt;');
    expect(view.html).toContain('02.41');
    expect(view.html).toContain('Total build cost');
    expect(view.html).not.toContain('Profit');
  });

  it('open book also shows cost and markup per line', async () => {
    const { svc, token } = setup({ book: 'open' });
    const html = (await svc.publicView(token)).html;
    expect(html).toContain('$1,000.00');
    expect(html).toContain('$300.00');
    expect(html).toContain('Profit');
  });

  it('a missing client role falls back to closed book, never to everything', async () => {
    const { svc } = setup({ role: null });
    expect(await svc.clientMoney(7)).toMatchObject({ cost: false, markup: false, price: true, total: true });
  });

  it('signing accepts it, keeps the signature, files the PDF and emails whoever sent it', async () => {
    const { svc, e, token, uploads, mails, logs } = setup();
    e.sentById = 'U1';
    await expect(svc.sign(token, { name: 'Kai Lono', email: 'kai@example.test', image: SIG, agree: true }, { ip: '1.2.3.4' })).resolves.toMatchObject({ accepted: true });
    expect(e).toMatchObject({ status: 'accepted', signedName: 'Kai Lono', signatureImage: SIG, signedIp: '1.2.3.4' });
    expect(logs.some((l) => l.action === 'accepted')).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(uploads[0][1]).toEqual(['Estimates']);
    expect(mails[0].to).toBe('edward@origami.test');
  });

  it('refuses to sign without agreeing, a name or a signature, or once replaced or accepted', async () => {
    const a = setup();
    await expect(a.svc.sign(a.token, { name: 'Kai', image: SIG }, {})).rejects.toThrow(/Tick the box/);
    await expect(a.svc.sign(a.token, { name: 'K', image: SIG, agree: true }, {})).rejects.toThrow(/full name/);
    await expect(a.svc.sign(a.token, { name: 'Kai Lono', image: 'x', agree: true }, {})).rejects.toThrow(/signature/);
    const b = setup({ status: 'superseded', others: [{ id: 'E2', rev: 3, status: 'sent' }] });
    expect((await b.svc.publicView(b.token)).replacedBy).toBe(3);
    await expect(b.svc.sign(b.token, { name: 'Kai Lono', image: SIG, agree: true }, {})).rejects.toThrow(/replaced by Rev 3/);
    const c = setup({ others: [{ id: 'E0', rev: 1, status: 'accepted' }] });
    expect((await c.svc.publicView(c.token)).canSign).toBe(false);
    await expect(c.svc.sign(c.token, { name: 'Kai Lono', image: SIG, agree: true }, {})).rejects.toThrow(/already been accepted/);
    await expect(a.svc.publicView('bad.token')).rejects.toThrow(/expired/);
  });

  it('sending marks a draft sent and emails the PDF with the accept link to the bill-to contact', async () => {
    const { svc, e, mails } = setup({ status: 'draft' });
    const out = await svc.send(7, 'E1', { note: 'Here it is' }, { name: 'Edward', id: 'U1' });
    expect(e.status).toBe('sent');
    expect(out.to).toBe('kai@example.test');
    expect(mails[0].attachments[0].filename).toBe('EST-001 Rev 2.pdf');
    expect(mails[0].html).toContain('/sign-estimate?token=');
    expect(mails[0].html).toContain('Review and accept the estimate');
    expect(e.sentById).toBe('U1');
  });

  it('the xlsx has the estimate and statements sheets, with scope subtotals as formulas', async () => {
    const { svc } = setup();
    const { buffer, filename } = await svc.xlsx(7, 'E1', { name: 'Edward' });
    expect(filename).toBe('EST-001 Rev 2.xlsx');
    const wb = new Workbook();
    await wb.xlsx.load(buffer as any);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Estimate', 'Statements']);
    const ws = wb.getWorksheet('Estimate')!;
    const formulas: string[] = [];
    ws.eachRow((r) => r.eachCell((c) => { if ((c.value as any)?.formula) formulas.push((c.value as any).formula); }));
    expect(formulas.some((f) => f.startsWith('SUM('))).toBe(true);
    expect(wb.getWorksheet('Statements')!.rowCount).toBe(3);
  });

  it('the html builder never shows money the book type hides', () => {
    const sh = sheet();
    const result = computeEstimate({ settings: { grPct: 17, profitPct: 12, contingencyPct: 5 }, scopes: sh.scopes, lines: sh.lines as any, gr: sh.gr });
    const none = { full: false, cost: false, markup: false, price: false, subtotal: false, grDetail: false, grTotal: false, profit: false, contingency: false, total: false };
    const html = estimateHtml({ estimate: { number: 'E', rev: 1, status: 'sent' }, scopes: sh.scopes, lines: sh.lines, gr: sh.gr, result, money: none, projectName: 'P', client: {}, brand: {} });
    expect(html).not.toMatch(/\$\d/);
  });
});
