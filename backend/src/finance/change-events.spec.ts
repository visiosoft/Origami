import { ChangeEventsService } from './change-events.service';

/** A tiny in-memory repository: enough for the workflow. */
function repo<T extends { id: string }>(rows: T[] = []) {
  const match = (r: any, where: any) => Object.entries(where || {}).every(([k, v]: any) => (v && typeof v === 'object' && '_value' in v ? (v._value as any[]).includes(r[k]) : r[k] === v));
  return {
    rows,
    create: (x: any) => ({ ...x }),
    save: jest.fn(async (x: any) => { const list = Array.isArray(x) ? x : [x]; for (const it of list) { const i = rows.findIndex((r) => r.id === it.id); if (i >= 0) rows[i] = { ...rows[i], ...it }; else rows.push({ ...it }); } return x; }),
    find: jest.fn(async (o: any = {}) => rows.filter((r) => match(r, o.where)).map((r) => ({ ...r }))),
    findOneBy: jest.fn(async (w: any) => { const r = rows.find((x) => match(x, w)); return r ? { ...r } : null; }),
    update: jest.fn(async (w: any, p: any) => { rows.filter((r) => match(r, w)).forEach((r) => Object.assign(r, p)); }),
  };
}

describe('change events: CE -> PCO -> CORs -> PCCO -> CCOs', () => {
  const actor: any = { name: 'Edward', id: 'U-1' };
  const make = () => {
    const events = repo<any>(); const cors = repo<any>(); const ccos = repo<any>(); const pccos = repo<any>();
    const commitments = repo<any>([{ id: 'SC1', projectId: 7, status: 'approved' }]); const lines = repo<any>([{ id: 'L0', commitmentId: 'SC1', lineOrder: 0, amount: 10000 }]);
    const projects = repo<any>([{ id: 7, name: 'HOM Cafe' } as any]);
    const fin: any = {
      need: jest.fn(async () => ({})), project: jest.fn(async () => ({ id: 7, name: 'HOM Cafe' })), log: jest.fn(async () => undefined),
      nextProjectNumber: jest.fn(async (r: any, pid: number, prefix: string) => `${prefix}-${String(r.rows.filter((x: any) => x.projectId === pid).length + 1).padStart(3, '0')}`),
    };
    const changeOrders: any = { onApproved: [], create: jest.fn(async (pid: number, dto: any) => { const co = { id: 'CO-X', number: 'CO-001', projectId: pid, ...dto }; pccos.rows.push(co); return co; }) };
    const svc = new ChangeEventsService(events as any, cors as any, ccos as any, pccos as any, commitments as any, lines as any, projects as any, fin, changeOrders);
    return { svc, events, cors, ccos, lines, changeOrders };
  };

  it('runs a change from the field to a signed sub change order', async () => {
    const { svc, cors, ccos, lines, changeOrders } = make();
    const ev = await svc.create(7, { title: 'Bathroom layout change', reason: 'client_request', originatorType: 'client' }, actor);
    expect(ev).toMatchObject({ number: 'CE-001', status: 'open' });

    const priced = await svc.sendPco(ev.id, { parties: [{ name: 'United Plumbing', commitmentId: 'SC1' }, { name: 'Origami', partyType: 'prime' }], note: 'Move the vanity', due: '2026-11-04' }, actor);
    expect(priced.status).toBe('pricing');
    expect(priced.cors.map((c: any) => [c.number, c.partyType, c.status])).toEqual([['COR-001', 'sub', 'requested'], ['COR-002', 'prime', 'requested']]);

    await svc.priceCor(cors.rows[0].id, { amount: 1000, scheduleImpactDays: 3 }, actor);
    const both = await svc.priceCor(cors.rows[1].id, { amount: 400 }, actor);
    expect(both.status).toBe('priced');
    await expect(svc.decideCor(cors.rows[1].id, 'hold', '', actor)).rejects.toThrow(/why/);
    await svc.decideCor(cors.rows[0].id, 'validate', undefined, actor);
    const after = await svc.decideCor(cors.rows[1].id, 'validate', undefined, actor);
    expect(after.totals).toMatchObject({ validated: 2, validatedCost: 1400, scheduleImpactDays: 3 });

    const pcco = await svc.makePcco({ corIds: cors.rows.map((c: any) => c.id), markupPct: 10 }, actor);
    expect(pcco.number).toBe('CO-001');
    const dto = changeOrders.create.mock.calls[0][1];
    expect(dto.items.map((i: any) => [i.amount, i.cost])).toEqual([[1100, 1000], [440, 400]]);
    expect(dto.scheduleImpactDays).toBe(3);
    await expect(svc.makePcco({ corIds: [cors.rows[0].id] }, actor)).rejects.toThrow(/already/);

    // The owner approves the PCCO: only the sub gets a CCO.
    await svc.makeCcos({ id: 'CO-X', projectId: 7 } as any, actor);
    expect(ccos.rows.map((c: any) => [c.number, c.partyName, c.amount, c.status])).toEqual([['CCO-001', 'United Plumbing', 1000, 'draft']]);
    await svc.actCco(ccos.rows[0].id, 'send', {}, actor);
    const signed = await svc.actCco(ccos.rows[0].id, 'sign', { signer: 'Jo at United', date: '2026-11-06' }, actor);
    expect(signed).toMatchObject({ status: 'signed', signer: 'Jo at United' });
    expect(lines.rows.find((l: any) => l.id === signed.commitmentLineId)).toMatchObject({ commitmentId: 'SC1', amount: 1000, lineOrder: 1 });
    await expect(svc.actCco(ccos.rows[0].id, 'void', { reason: 'x' }, actor)).rejects.toThrow(/signed/);
  });

  it('records a CCD / DCD directive so the work can proceed before pricing', async () => {
    const { svc } = make();
    const ev = await svc.create(7, { title: 'Hidden beam' }, actor);
    await expect(svc.directive(ev.id, { type: 'ccd', method: 'signature' }, actor)).rejects.toThrow(/signed/);
    const d = await svc.directive(ev.id, { type: 'ccd', method: 'verbal', note: 'Owner OK on site', date: '2026-11-01' }, actor);
    expect(d).toMatchObject({ directiveType: 'ccd', directiveMethod: 'verbal', directiveDate: '2026-11-01', directiveBy: 'Edward' });
  });
});
