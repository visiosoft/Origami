import { SpecialActionsService } from './special-actions.service';

function table(rows: any[] = []) {
  const match = (r: any, w: any) => Object.entries(w || {}).every(([k, v]) => r[k] === v);
  return {
    rows,
    find: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where)).map((r) => ({ ...r }))),
    findOneBy: jest.fn(async (w: any) => { const r = rows.find((x) => match(x, w)); return r ? { ...r } : null; }),
    save: jest.fn(async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); if (i >= 0) rows[i] = { ...x }; else rows.push({ ...x }); return x; }),
    update: jest.fn(async (w: any, patch: any) => { rows.filter((r) => match(r, w)).forEach((r) => Object.assign(r, patch)); }),
  } as any;
}

function setup() {
  const projects = table([{ id: 1, name: 'Chelliah' }, { id: 2, name: 'Maple' }, { id: 3, name: 'No Money' }]);
  const log = table([{ id: '20261017-01', topicType: 'Observation', subject: 'Crack in slab', description: 'North corner', project: 'Chelliah', tab: 'internal', activity: [] }]);
  const board = table();
  const meetings = table();
  const rfis = table([{ id: 'RFI1', number: 'RFI-001', projectId: 1, subject: 'Header size', question: 'What size?', history: [] }]);
  const cos = table();
  const items = table();
  const finLog: any[] = [];
  let n = 0;
  const tasks = {
    create: jest.fn(async (dto: any) => { const t = { id: `20261017-0${++n + 1}`, activity: [], ...dto }; log.rows.push(t); return t; }),
    link: jest.fn(async () => ({})),
  };
  const rfiSvc = {
    create: jest.fn(async (dto: any) => { const r = { id: 'RFI' + (rfis.rows.length + 1), number: `RFI-00${rfis.rows.filter((x: any) => x.projectId === dto.projectId).length + 1}`, projectId: dto.projectId, subject: dto.subject, history: [] }; rfis.rows.push(r); return r; }),
  };
  const coSvc = {
    create: jest.fn(async (projectId: number, dto: any) => {
      if (projectId === 3) throw new Error('Set up this project’s financials (the original contract) before adding change orders.');
      const c = { id: 'CO' + (cos.rows.length + 1), number: 'CO-001', projectId, title: dto.title, description: dto.description }; cos.rows.push(c); return c;
    }),
  };
  const fin = { log: jest.fn(async (_m: any, e: any) => { finLog.push(e); }) };
  const access = { can: jest.fn(async () => true) };
  const s = new SpecialActionsService(log, board, meetings, rfis, cos, items, projects, access as any, tasks as any, {} as any, {} as any, {} as any, rfiSvc as any, coSvc as any, fin as any);
  return { s, log, rfis, cos, finLog, tasks, rfiSvc, coSvc };
}
const actor = { id: 'U-1', name: 'Amara', roleKey: 'admin' };

describe('convert', () => {
  it('turns a FOR RECORD item into an RFI and records it on both', async () => {
    const t = setup();
    const made = await t.s.convert({ from: { kind: 'log', id: '20261017-01' }, to: 'rfi' }, actor);
    expect(made).toMatchObject({ kind: 'rfi', label: 'RFI-002', projectId: 1 });
    expect(t.rfiSvc.create).toHaveBeenCalledWith(expect.objectContaining({ projectId: 1, subject: 'Crack in slab', question: 'North corner', sourceTaskId: '20261017-01', sourceTaskType: 'log' }), actor);
    const rfi = t.rfis.rows.find((r: any) => r.id === made.id);
    expect(rfi).toMatchObject({ sourceType: 'log', sourceId: '20261017-01', sourceLabel: 'Observation #20261017-01' });
    expect(rfi.history.at(-1).action).toBe('Converted from Observation #20261017-01');
    const orig = t.log.rows[0];
    expect(orig.activity.at(-1).text).toBe('Converted to RFI-002');
    expect(orig.derivedRefs).toEqual([expect.objectContaining({ kind: 'rfi', id: made.id, label: 'RFI-002', how: 'converted' })]);
  });

  it('an RFI turned into a change order is linked back, and the audit log says where it came from', async () => {
    const t = setup();
    const made = await t.s.convert({ from: { kind: 'rfi', id: 'RFI1' }, to: 'co' }, actor);
    expect(t.rfis.rows[0]).toMatchObject({ changeOrderId: made.id, changeOrderNumber: 'CO-001' });
    expect(t.finLog.map((e) => e.action)).toEqual(['co_converted_from']);
    expect(t.finLog[0].reason).toBe('Converted from RFI-001');
  });

  it('refuses to "convert" into the same kind', async () => {
    const t = setup();
    await expect(t.s.convert({ from: { kind: 'rfi', id: 'RFI1' }, to: 'rfi' }, actor)).rejects.toThrow(/Duplicate/);
  });
});

describe('duplicate', () => {
  it('copies to several projects, reporting the ones that refuse', async () => {
    const t = setup();
    await t.s.convert({ from: { kind: 'rfi', id: 'RFI1' }, to: 'co' }, actor);
    const out = await t.s.duplicate({ kind: 'co', id: 'CO1', projectIds: [2, 3] }, actor);
    expect(out.created.map((c) => c.projectName)).toEqual(['Maple']);
    expect(out.failed).toEqual([expect.objectContaining({ projectName: 'No Money', reason: expect.stringMatching(/financials/) })]);
    expect(t.cos.rows[0].derivedRefs).toEqual([expect.objectContaining({ how: 'duplicated', projectName: 'Maple' })]);
    expect(t.cos.rows[1]).toMatchObject({ sourceType: 'co', sourceId: 'CO1', projectId: 2 });
  });

  it('a Request Log entry copied to another project takes that project’s name', async () => {
    const t = setup();
    const out = await t.s.duplicate({ kind: 'log', id: '20261017-01', projectIds: [2] }, actor);
    expect(t.tasks.create).toHaveBeenCalledWith(expect.objectContaining({ project: 'Maple', topicType: 'Observation', sourceId: '20261017-01' }), actor);
    expect(out.created[0].label).toMatch(/^Observation #/);
  });
});
