import { RfisService, addWorkingDays, ballInCourt, cleanContact } from './rfis.service';
import { rfiDocumentHtml } from './rfi.document';

function repo<T extends { id: any }>(rows: T[]) {
  return {
    rows,
    find: async (o?: any) => rows.filter((r: any) => !o?.where || Object.entries(o.where).every(([k, v]) => r[k] === v)),
    findOneBy: async (w: any) => rows.find((r: any) => Object.entries(w).every(([k, v]) => r[k] === v)) ?? null,
    create: (x: any) => ({ ...x }),
    save: async (r: T) => { const i = rows.findIndex((x) => x.id === r.id); if (i >= 0) rows[i] = r; else rows.push(r); return r; },
    remove: async (r: T) => { rows.splice(rows.indexOf(r), 1); return r; },
  };
}

function setup(opts: { role?: 'admin' | 'viewer' | 'none' } = {}) {
  const rfis = repo<any>([]);
  const projects = repo<any>([
    { id: 23, name: "Aquino's Kitchen and Bathroom Remodel", location: '12 Elm St, Tracy', leadId: 'PL-23' },
    { id: 24, name: "Sergio's Store", location: '' },
  ]);
  const users = repo<any>([{ id: 'u-astrid', name: 'Astrid Rivas', email: 'astrid@origami.test' }, { id: 'u-george', name: 'George Finau', email: 'george@origami.test' }]);
  const role = opts.role ?? 'admin';
  const access = { can: async (_a: any, _m: string, what: string) => role === 'admin' || (role === 'viewer' && what === 'view') };
  const sent: any[] = [];
  const google = { isConnected: async () => true, htmlToPdf: async () => Buffer.from('%PDF'), sendMail: async (m: any) => { sent.push(m); return {}; } };
  const settings = { get: async () => '', getMany: async () => ({}), baseUrl: async () => 'https://app.test' };
  const service = new RfisService(rfis as any, projects as any, users as any, access as any, google as any, settings as any, { discard: async () => undefined } as any);
  return { service, rfis, sent };
}

const astrid = { id: 'u-astrid', name: 'Astrid Rivas', roleKey: 'admin' };

describe('RFIs', () => {
  it('numbers per project and starts as a draft owned by whoever wrote it', async () => {
    const { service } = setup();
    const a = await service.create({ projectId: 23, subject: 'Beam size at kitchen opening', question: 'Confirm header size.' }, astrid);
    const b = await service.create({ projectId: 23, subject: 'Tile layout' }, astrid);
    const c = await service.create({ projectId: 24, subject: 'Storefront glazing' }, astrid);
    expect([a.number, b.number, c.number]).toEqual(['RFI-001', 'RFI-002', 'RFI-001']);
    expect(a).toMatchObject({ status: 'draft', ownerName: 'Astrid Rivas', ballInCourt: 'Astrid Rivas' });
  });

  it('finds the project from a Request Log task’s lead id or project name', async () => {
    const { service } = setup();
    expect((await service.create({ project: 'PL-23', subject: 'x', sourceTaskId: '20240410-11', sourceTaskType: 'log' }, astrid)).projectId).toBe(23);
    expect((await service.create({ projectName: "sergio's store", subject: 'y' }, astrid)).projectId).toBe(24);
    await expect(service.create({ projectName: 'Nowhere', subject: 'z' }, astrid)).rejects.toThrow('Which project');
  });

  it('sends: emails the recipient with the PDF, copies cc + owner, replies go to the owner, due in 7 working days', async () => {
    const { service, sent } = setup();
    const r = await service.create({
      projectId: 23, subject: 'Beam size', question: 'What header?',
      to: { name: 'Lido Jarrod', email: 'lido@arch.test', company: 'Lido Jarrod Design' }, cc: [{ name: 'Eng', email: 'eng@struct.test' }],
    }, astrid);
    const out = await service.send(r.id, { note: 'Needed before framing.' }, astrid);
    expect(out.status).toBe('open');
    expect(out.dateDue).toBe(addWorkingDays(out.dateSent, 7));
    expect(out.ballInCourt).toBe('Lido Jarrod');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'lido@arch.test', cc: 'eng@struct.test, astrid@origami.test', replyTo: 'astrid@origami.test' });
    expect(sent[0].subject).toBe("RFI-001: Beam size — Aquino's Kitchen and Bathroom Remodel");
    expect(sent[0].attachments[0].filename).toBe('RFI-001.pdf');
    expect(sent[0].html).toContain('Needed before framing.');
  });

  it('won’t send without an email address or a question', async () => {
    const { service } = setup();
    const r = await service.create({ projectId: 23, subject: 'x', question: 'q', to: { name: 'No email' } }, astrid);
    await expect(service.send(r.id, {}, astrid)).rejects.toThrow('email address');
    const r2 = await service.create({ projectId: 23, subject: 'x', to: { name: 'A', email: 'a@b.co' } }, astrid);
    await expect(service.send(r2.id, {}, astrid)).rejects.toThrow('question');
  });

  it('answer → close → reopen, with impact recorded and history kept', async () => {
    const { service } = setup();
    const r = await service.create({ projectId: 23, subject: 'x', question: 'q', to: { name: 'A', email: 'a@b.co' } }, astrid);
    await service.send(r.id, {}, astrid);
    const ans = await service.answer(r.id, { answer: 'Use 4x12 DF#1.', costImpact: 'yes', costAmount: '1250.5', scheduleImpact: 'none' }, astrid);
    expect(ans).toMatchObject({ status: 'answered', answeredBy: 'A', costImpact: 'yes', costAmount: 1250.5, scheduleImpact: 'none', ballInCourt: 'Astrid Rivas' });
    const closed = await service.close(r.id, {}, astrid);
    expect(closed.status).toBe('closed');
    await expect(service.update(r.id, { subject: 'changed' }, astrid)).rejects.toThrow('reopen');
    expect((await service.reopen(r.id, astrid)).status).toBe('answered');
    expect(closed.history.map((h: any) => h.action)).toEqual(['created', 'sent to A', 'answer recorded (from A)', 'closed']);
  });

  it('a sent RFI can’t be deleted — only voided, with a reason', async () => {
    const { service, rfis } = setup();
    const r = await service.create({ projectId: 23, subject: 'x', question: 'q', to: { name: 'A', email: 'a@b.co' } }, astrid);
    await service.markSent(r.id, astrid);
    await expect(service.remove(r.id, astrid)).rejects.toThrow('void it instead');
    await expect(service.void(r.id, {}, astrid)).rejects.toThrow('why');
    expect((await service.void(r.id, { reason: 'Duplicate of RFI-002' }, astrid)).status).toBe('void');
    const d = await service.create({ projectId: 23, subject: 'draft' }, astrid);
    await service.remove(d.id, astrid);
    expect(rfis.rows.find((x) => x.id === d.id)).toBeUndefined();
  });

  it('respects the role: view-only can read but not write; no RFI permission can’t read', async () => {
    const admin = setup();
    await admin.service.create({ projectId: 23, subject: 'x' }, astrid);
    const viewer = setup({ role: 'viewer' });
    await expect(viewer.service.create({ projectId: 23, subject: 'x' }, astrid)).rejects.toThrow("doesn't allow");
    expect(await viewer.service.list(astrid)).toEqual([]);
    await expect(setup({ role: 'none' }).service.list(astrid)).rejects.toThrow("doesn't include RFIs");
  });

  it('contacts: header-injection or junk emails are dropped', () => {
    expect(cleanContact({ name: 'X', email: 'x@y.co\r\nBcc: evil@z.co' })).toEqual({ name: 'X' });
    expect(cleanContact({ name: '', email: 'ok@y.co' })).toEqual({ name: 'ok@y.co', email: 'ok@y.co' });
    expect(cleanContact({ name: '', email: '' })).toBeNull();
  });

  it('helpers: working days skip the weekend; ball in court follows the status', () => {
    expect(addWorkingDays('2026-09-25', 1)).toBe('2026-09-28'); // Fri -> Mon
    expect(ballInCourt({ status: 'closed', to: null, ownerName: 'A' })).toBe('');
  });

  it('the PDF form escapes what people typed', () => {
    const html = rfiDocumentHtml({ number: 'RFI-001', subject: '<script>x</script>', status: 'open', question: 'a & b' } as any, { name: 'P' }, 'Origami');
    expect(html).not.toContain('<script>');
    expect(html).toContain('a &amp; b');
  });
});
