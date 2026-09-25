import { ProjectHoldService, HOLD_TASK_LABEL, holdTaskText } from './project-hold.service';

/** Tiny in-memory stand-ins: a repo keyed by id, and a task service that records what it did. */
function repo<T extends { id: any }>(rows: T[]) {
  return {
    rows,
    findOneBy: async (w: any) => rows.find((r) => r.id === w.id) ?? null,
    save: async (r: T) => { const i = rows.findIndex((x) => x.id === r.id); if (i >= 0) rows[i] = r; else rows.push(r); return r; },
  };
}

function setup() {
  const projects = repo<any>([{ id: 24, name: "Sergio's Store", stage: 'Kickoff' }]);
  const tasks = repo<any>([]);
  const users = repo<any>([{ id: 'u-andrea', name: 'Andrea Castillo' }, { id: 'u-astrid', name: 'Astrid Rivas' }]);
  const taskService = {
    create: async (dto: any) => { const t = { ...dto, status: 'Not started', completed: false }; tasks.rows.push(t); return t; },
    update: async (id: string, patch: any) => { const t = tasks.rows.find((x) => x.id === id); Object.assign(t, patch); if (patch.status === 'Done') t.completed = true; return t; },
  };
  const service = new ProjectHoldService(projects as any, tasks as any, users as any, taskService as any);
  return { service, projects, tasks };
}

const astrid = { id: 'u-astrid', name: 'Astrid Rivas' };

describe('project hold', () => {
  it('parks the project and gives the follow-up to the chosen person, due on the date', async () => {
    const { service, projects, tasks } = setup();
    const p = await service.hold(24, { until: '2026-10-25', reason: 'Client waiting on financing', followUpId: 'u-andrea' }, astrid);
    expect(p.holdSince).toBeTruthy();
    expect(p.holdUntil).toBe('2026-10-25');
    expect(p.stage).toBe('Kickoff');
    expect(tasks.rows).toHaveLength(1);
    const t = tasks.rows[0];
    expect(t).toMatchObject({ projectId: 24, dueDate: '2026-10-25', assigneeId: 'u-andrea', labels: [HOLD_TASK_LABEL] });
    expect(t.title).toBe("Follow up: Sergio's Store is on hold");
    expect(t.description).toContain('Client waiting on financing');
    expect(projects.rows[0].holdHistory).toEqual([expect.objectContaining({ action: 'hold', by: 'Astrid Rivas', followUp: 'Andrea Castillo' })]);
  });

  it('changing the hold moves the same task rather than adding another', async () => {
    const { service, tasks, projects } = setup();
    await service.hold(24, { until: '2026-10-25', followUpId: 'u-andrea' }, astrid);
    await service.hold(24, { until: '2026-11-30', reason: 'Pushed again' }, astrid);
    expect(tasks.rows).toHaveLength(1);
    expect(tasks.rows[0].dueDate).toBe('2026-11-30');
    expect(projects.rows[0].holdHistory.map((h: any) => h.action)).toEqual(['hold', 'changed']);
  });

  it('resuming clears the hold and ticks off the follow-up', async () => {
    const { service, tasks } = setup();
    await service.hold(24, { until: '2026-10-25' }, astrid);
    const p = await service.resume(24, astrid);
    expect(p.holdSince).toBe('');
    expect(p.holdTaskId).toBe('');
    expect(tasks.rows[0].status).toBe('Done');
    expect(p.holdHistory?.at(-1)?.action).toBe('resumed');
  });

  it('a new hold after the follow-up was done starts a fresh task', async () => {
    const { service, tasks } = setup();
    await service.hold(24, { until: '2026-10-25' }, astrid);
    tasks.rows[0].status = 'Done'; tasks.rows[0].completed = true;
    await service.hold(24, { until: '2026-12-01' }, astrid);
    expect(tasks.rows).toHaveLength(2);
    expect(tasks.rows[1].assigneeId).toBe('u-astrid');
  });

  it('refuses a hold with no follow-up date', async () => {
    const { service } = setup();
    await expect(service.hold(24, { until: '' }, astrid)).rejects.toThrow('Pick the date');
  });

  it('task text reads cleanly without a reason', () => {
    expect(holdTaskText({ name: 'X' }, { until: '2026-10-25' }, '2026-09-25T10:00:00Z', 'Astrid').description)
      .toBe('Put on hold Sep 25, 2026 by Astrid.\nCheck in with the client and either resume the project or push the follow-up date.');
  });
});
