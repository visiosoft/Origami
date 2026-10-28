import { BadRequestException } from '@nestjs/common';
import { MeetingsService } from './meetings.service';

/** In-memory stand-ins: `In(...)` filters are ignored -- the service matches ids itself. */
describe('MeetingsService', () => {
  const setup = () => {
    const meetings: any[] = [];
    const tasks: any[] = [{ id: 'T1', meetingId: 'M1', status: 'Open', topicType: 'Task' }, { id: 'T2', meetingId: 'M2', status: 'Open', topicType: 'Task' }];
    const rfis: any[] = [];
    const cos: any[] = [];
    const created: any[] = [];
    const repo = {
      create: (r: any) => r,
      save: async (r: any) => { const i = meetings.findIndex((m) => m.id === r.id); if (i >= 0) meetings[i] = r; else meetings.push(r); return r; },
      findOneBy: async (w: any) => meetings.find((m) => m.id === w.id) || null,
      find: async () => meetings,
      remove: async (r: any) => { meetings.splice(meetings.indexOf(r), 1); },
    };
    const tasksRepo = {
      update: async (w: any, p: any) => tasks.filter((t) => t.meetingId === w.meetingId).forEach((t) => Object.assign(t, p)),
      find: async () => tasks,
    };
    const tasksSvc = {
      create: async (dto: any) => { created.push(dto); const t = { id: 'NEW' + created.length, status: 'Open', ...dto }; tasks.push(t); return t; },
      statuses: async () => [{ name: 'Open' }, { name: 'Closed', closed: true }],
    };
    const svc = new MeetingsService(repo as any, tasksRepo as any, tasksSvc as any, { find: async () => rfis } as any, { find: async () => cos } as any);
    return { svc, meetings, tasks, rfis, cos, created };
  };

  it('needs a title and a real date', async () => {
    const { svc } = setup();
    await expect(svc.create({ title: ' ', date: '2026-10-08' }, { name: 'A' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create({ title: 'OAC', date: 'Oct 8' }, { name: 'A' })).rejects.toBeInstanceOf(BadRequestException);
    const m = await svc.create({ title: ' OAC meeting ', date: '2026-10-08', locationType: 'virtual' }, { name: 'Sara R.' });
    expect(m).toMatchObject({ title: 'OAC meeting', status: 'scheduled', type: 'Internal', locationType: 'virtual', createdBy: 'Sara R.' });
  });

  it('raises an action as a Request Log entry carrying the meeting', async () => {
    const { svc, created } = setup();
    const m = await svc.create({ title: 'Site walk', date: '2026-10-08', type: 'Site', project: 'Chelliah Residence', projectId: 2 }, { name: 'A' });
    await svc.addAction(m.id, { topicType: 'Observation', subject: '  Water at north footing ', assignedTo: 'Edward' }, { name: 'George' });
    expect(created[0]).toMatchObject({ topicType: 'Observation', subject: 'Water at north footing', project: 'Chelliah Residence', meetingType: 'Site', meetingDate: '2026-10-08', meetingId: m.id });
  });

  it('records a decision from a meeting', async () => {
    const { svc, created } = setup();
    const m = await svc.create({ title: 'OAC', date: '2026-10-08' }, { name: 'A' });
    await svc.addAction(m.id, { topicType: 'Decision', subject: 'Go with the oak flooring' }, { name: 'George' });
    expect(created[0]).toMatchObject({ topicType: 'Decision', subject: 'Go with the oak flooring', meetingId: m.id });
  });

  it('deleting a meeting keeps its actions, unlinked', async () => {
    const { svc, meetings, tasks } = setup();
    meetings.push({ id: 'M1', title: 'x', date: '2026-10-01' });
    await svc.remove('M1');
    expect(meetings).toHaveLength(0);
    expect(tasks.find((t) => t.id === 'T1')!.meetingId).toBeNull();
    expect(tasks.find((t) => t.id === 'T2')!.meetingId).toBe('M2');
  });

  it('moves "held" meetings to "occurred" on start-up', async () => {
    const { svc, meetings } = setup();
    meetings.push({ id: 'A', status: 'held' }, { id: 'B', status: 'scheduled' }, { id: 'C', status: 'cancelled' });
    expect(await svc.migrateStatuses()).toBe(1);
    expect(meetings.map((m) => m.status)).toEqual(['occurred', 'scheduled', 'cancelled']);
  });

  it('stores "held" sent by an older screen as "occurred", and stamps the reviewer', async () => {
    const { svc, meetings } = setup();
    meetings.push({ id: 'M9', title: 'x', date: '2026-10-01', status: 'scheduled' });
    expect((await svc.update('M9', { status: 'held' }, { name: 'A' })).status).toBe('occurred');
    const r = await svc.update('M9', { status: 'reviewed' }, { name: 'Sara' });
    expect(r).toMatchObject({ status: 'reviewed', reviewedBy: 'Sara' });
    expect(r.reviewedAt).toBeTruthy();
  });

  it('completes a reviewed meeting when every captured task, RFI and change order is done, and saves it', async () => {
    const { svc, meetings, tasks, rfis, cos } = setup();
    meetings.push({ id: 'M1', title: 'OAC', date: '2026-10-01', status: 'reviewed', rfiIds: ['R1'], changeOrderIds: ['C1'] });
    rfis.push({ id: 'R1', status: 'answered' });
    cos.push({ id: 'C1', status: 'approved' });
    // An open FYI raised in it is on record, not an action: it doesn't hold the meeting open.
    tasks.push({ id: 'T3', meetingId: 'M1', status: 'Open', topicType: 'FYI' });
    expect((await svc.get('M1')).status).toBe('reviewed'); // T1 open, RFI answered
    tasks.find((t) => t.id === 'T1')!.status = 'Closed';
    expect((await svc.get('M1')).status).toBe('reviewed'); // RFI answered, not closed
    rfis[0].status = 'closed';
    const listed = (await svc.list()).find((m) => m.id === 'M1')!;
    expect(listed.status).toBe('complete');
    expect(meetings[0].status).toBe('complete');
    // Raising another action reopens it.
    await svc.addAction('M1', { topicType: 'Task', subject: 'One more thing' }, { name: 'A' });
    expect(meetings[0].status).toBe('reviewed');
  });

  it('leaves an occurred meeting alone even when everything in it is done', async () => {
    const { svc, meetings, tasks } = setup();
    meetings.push({ id: 'M1', title: 'OAC', date: '2026-10-01', status: 'occurred' });
    tasks.find((t) => t.id === 'T1')!.status = 'Closed';
    expect((await svc.get('M1')).status).toBe('occurred');
  });
});
