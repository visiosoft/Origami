import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';

/** FOR RECORD entries (observations, FYIs, decisions) linked to tasks and change orders. */
describe('TasksService FOR RECORD links', () => {
  const setup = () => {
    const rows: any[] = [
      { id: 'D1', topicType: 'Decision', subject: 'Use oak flooring', project: 'Chelliah Residence', meetingId: 'MTG-1', meetingType: 'Client', meetingDate: '2026-10-08', tab: 'internal', status: 'Open', activity: [] },
      { id: 'T1', topicType: 'Task', subject: 'Order flooring', project: 'Chelliah Residence', status: 'Open', activity: [] },
    ];
    const cos = [{ id: 'CO-1', number: 'CO-003', title: 'Oak flooring upgrade' }];
    const repo = {
      create: (r: any) => r,
      find: async () => rows,
      findOneBy: async (w: any) => rows.find((r) => r.id === w.id) || null,
      save: async (r: any) => { const i = rows.findIndex((x) => x.id === r.id); if (i >= 0) rows[i] = r; else rows.push(r); return r; },
    };
    const users = { findOneBy: async () => null, find: async () => [] };
    const notifications = { taskAssigned: () => undefined, taskFollowUp: () => undefined };
    const cosRepo = { findOneBy: async (w: any) => cos.find((c) => c.id === w.id) || null };
    const svc = new TasksService(repo as any, users as any, {} as any, notifications as any, undefined, cosRepo as any);
    return { svc, rows };
  };
  const actor = { name: 'George' };

  it('links an entry to a task on both sides, once', async () => {
    const { svc, rows } = setup();
    await svc.link('D1', 'task', 'T1', actor);
    const d = await svc.link('D1', 'task', 'T1', actor);
    expect(d.linkedTaskIds).toEqual(['T1']);
    expect(rows.find((r) => r.id === 'T1').linkedTaskIds).toEqual(['D1']);
    expect(d.activity.filter((e: any) => e.type === 'link')).toHaveLength(1);
  });

  it('unlinks from both sides', async () => {
    const { svc, rows } = setup();
    await svc.link('D1', 'task', 'T1', actor);
    const d = await svc.unlink('D1', 'task', 'T1', actor);
    expect(d.linkedTaskIds).toEqual([]);
    expect(rows.find((r) => r.id === 'T1').linkedTaskIds).toEqual([]);
  });

  it('links an entry to a change order that exists', async () => {
    const { svc } = setup();
    const d = await svc.link('D1', 'changeOrder', 'CO-1', actor);
    expect(d.changeOrderIds).toEqual(['CO-1']);
    expect(d.activity[d.activity.length - 1].text).toContain('CO-003');
    await expect(svc.link('D1', 'changeOrder', 'CO-404', actor)).rejects.toBeInstanceOf(NotFoundException);
    const off = await svc.unlink('D1', 'changeOrder', 'CO-1', actor);
    expect(off.changeOrderIds).toEqual([]);
  });

  it('refuses a missing task, itself, or nothing', async () => {
    const { svc } = setup();
    await expect(svc.link('D1', 'task', 'NOPE', actor)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.link('D1', 'task', 'D1', actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.link('D1', 'task', ' ', actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a task from an entry on the same project and meeting, linked both ways', async () => {
    const { svc } = setup();
    const { task, entry } = await svc.createLinkedTask('D1', {}, actor);
    expect(task).toMatchObject({ topicType: 'Task', subject: 'Follow up: Use oak flooring', project: 'Chelliah Residence', meetingId: 'MTG-1', meetingType: 'Client', linkedTaskIds: ['D1'] });
    expect(task.description).toContain('Decision D1');
    expect(entry.linkedTaskIds).toEqual([task.id]);
  });
});
