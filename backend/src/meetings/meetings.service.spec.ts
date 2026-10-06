import { BadRequestException } from '@nestjs/common';
import { MeetingsService } from './meetings.service';

describe('MeetingsService', () => {
  const setup = () => {
    const meetings: any[] = [];
    const tasks: any[] = [{ id: 'T1', meetingId: 'M1' }, { id: 'T2', meetingId: 'M2' }];
    const created: any[] = [];
    const repo = {
      create: (r: any) => r,
      save: async (r: any) => { const i = meetings.findIndex((m) => m.id === r.id); if (i >= 0) meetings[i] = r; else meetings.push(r); return r; },
      findOneBy: async (w: any) => meetings.find((m) => m.id === w.id) || null,
      find: async () => meetings,
      remove: async (r: any) => { meetings.splice(meetings.indexOf(r), 1); },
    };
    const tasksRepo = { update: async (w: any, p: any) => tasks.filter((t) => t.meetingId === w.meetingId).forEach((t) => Object.assign(t, p)) };
    const tasksSvc = { create: async (dto: any) => { created.push(dto); return { id: 'NEW', ...dto }; } };
    return { svc: new MeetingsService(repo as any, tasksRepo as any, tasksSvc as any), meetings, tasks, created };
  };

  it('needs a title and a real date', async () => {
    const { svc } = setup();
    await expect(svc.create({ title: ' ', date: '2026-10-08' }, { name: 'A' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create({ title: 'OAC', date: 'Oct 8' }, { name: 'A' })).rejects.toBeInstanceOf(BadRequestException);
    const m = await svc.create({ title: ' OAC meeting ', date: '2026-10-08' }, { name: 'Sara R.' });
    expect(m).toMatchObject({ title: 'OAC meeting', status: 'scheduled', type: 'Internal', createdBy: 'Sara R.' });
  });

  it('raises an action as a Request Log entry carrying the meeting', async () => {
    const { svc, created } = setup();
    const m = await svc.create({ title: 'Site walk', date: '2026-10-08', type: 'Site', project: 'Chelliah Residence', projectId: 2 }, { name: 'A' });
    await svc.addAction(m.id, { topicType: 'Observation', subject: '  Water at north footing ', assignedTo: 'Edward' }, { name: 'George' });
    expect(created[0]).toMatchObject({ topicType: 'Observation', subject: 'Water at north footing', project: 'Chelliah Residence', meetingType: 'Site', meetingDate: '2026-10-08', meetingId: m.id });
  });

  it('deleting a meeting keeps its actions, unlinked', async () => {
    const { svc, meetings, tasks } = setup();
    meetings.push({ id: 'M1', title: 'x', date: '2026-10-01' });
    await svc.remove('M1');
    expect(meetings).toHaveLength(0);
    expect(tasks.find((t) => t.id === 'T1')!.meetingId).toBeNull();
    expect(tasks.find((t) => t.id === 'T2')!.meetingId).toBe('M2');
  });
});
